import type { BacktestSummary, PortfolioAnalysis, PortfolioPosition, Recommendation } from "./portfolio"
import { CATALOG_BY_SYMBOL, round } from "./portfolio"

export type HistoricalPricePoint = {
  timestamp: string
  price: number
}

export type HistoricalPriceSeries = {
  cmcId: number
  symbol: string
  points: HistoricalPricePoint[]
}

type ReplayResult = {
  totalReturn: number
  maxDrawdown: number
  sharpe: number
  observations: number
  startDate: string
  endDate: string
}

export function applyHistoricalBacktest(
  analysis: PortfolioAnalysis,
  historicalSeries: HistoricalPriceSeries[],
): PortfolioAnalysis {
  const replay = runHistoricalBacktest({
    positions: analysis.positions,
    recommendations: analysis.recommendations,
    historicalSeries,
    transactionCostBps: analysis.strategySpec.backtestConfig.transactionCostBps,
    slippageBps: analysis.strategySpec.backtestConfig.slippageBps,
  })

  if (!replay) return analysis

  return {
    ...analysis,
    backtest: replay,
  }
}

export function runHistoricalBacktest(params: {
  positions: PortfolioPosition[]
  recommendations: Recommendation[]
  historicalSeries: HistoricalPriceSeries[]
  transactionCostBps: number
  slippageBps: number
}): BacktestSummary | null {
  const historyBySymbol = buildHistoryMap(params.historicalSeries)
  const dates = buildReplayDates(historyBySymbol)
  if (dates.length < 20) return null

  const currentWeights = normalizeWeights(new Map(params.positions.map((position) => [position.symbol, position.weight])))
  const targetWeights = normalizeWeights(
    new Map(params.recommendations.map((recommendation) => [recommendation.symbol, recommendation.targetWeight])),
  )
  const benchmarkWeights = normalizeWeights(
    new Map([
      ["BTC", 50],
      ["ETH", 30],
      ["BNB", 10],
      [targetWeights.has("USDC") ? "USDC" : "USDT", 10],
    ]),
  )

  const turnover = calculateTurnover(currentWeights, targetWeights)
  const totalCostBps = params.transactionCostBps + params.slippageBps
  const turnoverCost = (turnover * totalCostBps) / 100
  const current = simulateWeights(currentWeights, historyBySymbol, dates, 0)
  const optimized = simulateWeights(targetWeights, historyBySymbol, dates, turnoverCost)
  const benchmark = simulateWeights(benchmarkWeights, historyBySymbol, dates, 0)

  if (!current || !optimized || !benchmark) return null

  return {
    method: "historical-replay",
    lookbackLabel: `${current.observations} daily CMC historical quote observations`,
    currentReturn: round(current.totalReturn),
    optimizedReturn: round(optimized.totalReturn),
    currentDrawdownProxy: round(current.maxDrawdown),
    optimizedDrawdownProxy: round(optimized.maxDrawdown),
    benchmarkReturn: round(benchmark.totalReturn),
    currentSharpe: round(current.sharpe),
    optimizedSharpe: round(optimized.sharpe),
    benchmarkSharpe: round(benchmark.sharpe),
    startDate: current.startDate,
    endDate: current.endDate,
    observations: current.observations,
    turnoverCost: round(turnoverCost),
    notes: [
      "Replay uses daily CoinMarketCap historical quote prices for the exported universe.",
      "Optimized return is reduced by estimated turnover, transaction cost, and slippage.",
      "Stablecoin sleeves are modeled as flat USD exposure unless CMC historical prices are available.",
      "No live execution is triggered; Track 2 asks for strategy skills, not a live-trading agent.",
    ],
  }
}

function buildHistoryMap(series: HistoricalPriceSeries[]) {
  const map = new Map<string, Map<string, number>>()
  for (const asset of series) {
    const byDate = new Map<string, number>()
    const sorted = [...asset.points].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    for (const point of sorted) {
      if (!Number.isFinite(point.price) || point.price <= 0) continue
      byDate.set(toDateKey(point.timestamp), point.price)
    }
    if (byDate.size >= 2) map.set(asset.symbol.toUpperCase(), byDate)
  }
  return map
}

function buildReplayDates(historyBySymbol: Map<string, Map<string, number>>) {
  const dates = new Set<string>()
  for (const byDate of historyBySymbol.values()) {
    for (const date of byDate.keys()) dates.add(date)
  }
  return Array.from(dates).sort()
}

function simulateWeights(
  weights: Map<string, number>,
  historyBySymbol: Map<string, Map<string, number>>,
  dates: string[],
  initialCostPercent: number,
): ReplayResult | null {
  if (!weights.size || dates.length < 2) return null

  const dailyReturns: number[] = []
  const equity: number[] = [100 * (1 - initialCostPercent / 100)]
  let previousDate = dates[0]

  for (let i = 1; i < dates.length; i += 1) {
    const date = dates[i]
    let portfolioReturn = 0
    let coveredWeight = 0

    for (const [symbol, weight] of weights.entries()) {
      const normalizedWeight = weight / 100
      if (isStableSymbol(symbol)) {
        coveredWeight += weight
        continue
      }

      const previousPrice = priceOnOrBefore(historyBySymbol.get(symbol), previousDate)
      const currentPrice = priceOnOrBefore(historyBySymbol.get(symbol), date)
      if (!previousPrice || !currentPrice) continue

      portfolioReturn += normalizedWeight * (currentPrice / previousPrice - 1)
      coveredWeight += weight
    }

    if (coveredWeight < 60) continue
    const nextEquity = equity[equity.length - 1] * (1 + portfolioReturn)
    if (Number.isFinite(nextEquity) && nextEquity > 0) {
      equity.push(nextEquity)
      dailyReturns.push(portfolioReturn)
      previousDate = date
    }
  }

  if (dailyReturns.length < 20) return null

  return {
    totalReturn: (equity[equity.length - 1] / equity[0] - 1) * 100,
    maxDrawdown: calculateMaxDrawdown(equity),
    sharpe: calculateSharpe(dailyReturns),
    observations: dailyReturns.length,
    startDate: dates[0],
    endDate: dates[dates.length - 1],
  }
}

function normalizeWeights(weights: Map<string, number>) {
  const cleaned = new Map<string, number>()
  for (const [symbol, weight] of weights.entries()) {
    if (Number.isFinite(weight) && weight > 0) {
      cleaned.set(symbol.toUpperCase(), weight)
    }
  }
  const total = Array.from(cleaned.values()).reduce((sum, value) => sum + value, 0)
  if (total <= 0) return cleaned
  for (const [symbol, weight] of cleaned.entries()) {
    cleaned.set(symbol, (weight / total) * 100)
  }
  return cleaned
}

function calculateTurnover(currentWeights: Map<string, number>, targetWeights: Map<string, number>) {
  const symbols = new Set([...currentWeights.keys(), ...targetWeights.keys()])
  let gross = 0
  for (const symbol of symbols) {
    gross += Math.abs((targetWeights.get(symbol) ?? 0) - (currentWeights.get(symbol) ?? 0))
  }
  return gross / 200
}

function calculateMaxDrawdown(equity: number[]) {
  let peak = equity[0] ?? 0
  let maxDrawdown = 0
  for (const value of equity) {
    peak = Math.max(peak, value)
    if (peak > 0) {
      maxDrawdown = Math.min(maxDrawdown, (value / peak - 1) * 100)
    }
  }
  return maxDrawdown
}

function calculateSharpe(returns: number[]) {
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length
  const volatility = Math.sqrt(variance)
  if (!Number.isFinite(volatility) || volatility === 0) return 0
  return (mean / volatility) * Math.sqrt(365)
}

function priceOnOrBefore(pricesByDate: Map<string, number> | undefined, date: string) {
  if (!pricesByDate) return null
  const direct = pricesByDate.get(date)
  if (direct) return direct

  let latest: string | null = null
  for (const key of pricesByDate.keys()) {
    if (key <= date && (!latest || key > latest)) latest = key
  }
  return latest ? (pricesByDate.get(latest) ?? null) : null
}

function isStableSymbol(symbol: string) {
  const meta = CATALOG_BY_SYMBOL.get(symbol.toUpperCase())
  return meta?.role === "stable" || meta?.role === "cash" || ["USDT", "USDC", "DAI", "FDUSD"].includes(symbol.toUpperCase())
}

function toDateKey(timestamp: string) {
  return new Date(timestamp).toISOString().slice(0, 10)
}
