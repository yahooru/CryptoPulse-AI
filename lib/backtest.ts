import type { BacktestSummary, PortfolioAnalysis, PortfolioPosition, Recommendation } from "./portfolio"
import { CATALOG_BY_SYMBOL, round } from "./portfolio"

export type HistoricalPricePoint = {
  timestamp: string
  price: number
}

export type HistoricalPriceSeries = {
  cmcId: number
  symbol: string
  source?: "coinmarketcap" | "binance"
  points: HistoricalPricePoint[]
}

type ReplayResult = {
  totalReturn: number
  maxDrawdown: number
  sharpe: number
  observations: number
  startDate: string
  endDate: string
  rebalanceEvents?: number
  turnoverCost?: number
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
  const optimized = simulateDynamicStrategy(targetWeights, historyBySymbol, dates, totalCostBps, turnoverCost)
  const benchmark = simulateWeights(benchmarkWeights, historyBySymbol, dates, 0)

  if (!current || !optimized || !benchmark) return null

  const requestedSymbols = new Set([
    ...params.positions.map((position) => position.symbol),
    ...params.recommendations.map((recommendation) => recommendation.symbol),
    "BTC",
    "ETH",
    "BNB",
  ])
  const replayedSymbols = new Set(historyBySymbol.keys())
  const missingAssets = Array.from(requestedSymbols).filter((symbol) => !isStableSymbol(symbol) && !replayedSymbols.has(symbol))
  const provider = classifyProvider(params.historicalSeries)

  return {
    method: "historical-replay",
    dataProvider: provider,
    lookbackLabel: `${current.observations} daily ${providerLabel(provider)} observations`,
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
    turnoverCost: round(optimized.turnoverCost ?? turnoverCost),
    rebalanceEvents: optimized.rebalanceEvents,
    dataCoverage: {
      requestedAssets: requestedSymbols.size,
      replayedAssets: replayedSymbols.size,
      missingAssets,
      coveragePct: round((replayedSymbols.size / Math.max(1, requestedSymbols.size)) * 100),
    },
    dynamicRules: [
      "Weekly rebalance to target sleeves.",
      "Increase stablecoin exposure when BTC and ETH 7-day momentum turns negative.",
      "Reduce satellite sleeves when their 14-day momentum is negative.",
      "Apply estimated turnover, transaction cost, and slippage at each rebalance.",
    ],
    notes: [
      "Replay uses daily historical prices from CoinMarketCap first and Binance daily candles for missing exchange-traded assets.",
      "Optimized replay is a weekly dynamic rebalance, not a static one-time target allocation.",
      "Optimized return is reduced by estimated turnover, transaction cost, and slippage at each rebalance.",
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

function simulateDynamicStrategy(
  baseWeights: Map<string, number>,
  historyBySymbol: Map<string, Map<string, number>>,
  dates: string[],
  totalCostBps: number,
  initialCostPercent: number,
): ReplayResult | null {
  if (!baseWeights.size || dates.length < 2) return null

  let activeWeights = normalizeWeights(new Map(baseWeights))
  const dailyReturns: number[] = []
  const equity: number[] = [100 * (1 - initialCostPercent / 100)]
  let previousDate = dates[0]
  let rebalanceEvents = 0
  let accumulatedTurnoverCost = initialCostPercent

  for (let i = 1; i < dates.length; i += 1) {
    const date = dates[i]
    if (i === 1 || i % 7 === 0) {
      const nextWeights = buildDynamicWeights(baseWeights, historyBySymbol, date)
      const turnover = calculateTurnover(activeWeights, nextWeights)
      const costPercent = (turnover * totalCostBps) / 100
      if (costPercent > 0) {
        equity[equity.length - 1] *= 1 - costPercent / 100
        accumulatedTurnoverCost += costPercent
      }
      activeWeights = nextWeights
      rebalanceEvents += 1
    }

    const portfolioReturn = calculateDailyReturn(activeWeights, historyBySymbol, previousDate, date)
    if (portfolioReturn === null) continue

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
    rebalanceEvents,
    turnoverCost: accumulatedTurnoverCost,
  }
}

function calculateDailyReturn(
  weights: Map<string, number>,
  historyBySymbol: Map<string, Map<string, number>>,
  previousDate: string,
  date: string,
) {
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

  return coveredWeight >= 60 ? portfolioReturn : null
}

function buildDynamicWeights(
  baseWeights: Map<string, number>,
  historyBySymbol: Map<string, Map<string, number>>,
  date: string,
) {
  const weights = normalizeWeights(new Map(baseWeights))
  const stableSymbol = weights.has("USDC") && !weights.has("USDT") ? "USDC" : "USDT"
  if (!weights.has(stableSymbol)) weights.set(stableSymbol, 0)

  const btcMomentum = momentum(historyBySymbol.get("BTC"), date, 7)
  const ethMomentum = momentum(historyBySymbol.get("ETH"), date, 7)
  const anchorMomentum = averageDefined([btcMomentum, ethMomentum])
  const stableTarget = anchorMomentum !== null && anchorMomentum < 0 ? 24 : anchorMomentum !== null && anchorMomentum > 0.05 ? 10 : weights.get(stableSymbol) ?? 15
  resizeStableSleeve(weights, stableSymbol, stableTarget)

  for (const [symbol, weight] of Array.from(weights.entries())) {
    const meta = CATALOG_BY_SYMBOL.get(symbol)
    if (!meta || meta.role === "core" || meta.role === "stable") continue
    const satelliteMomentum = momentum(historyBySymbol.get(symbol), date, 14)
    if (satelliteMomentum !== null && satelliteMomentum < 0) {
      const reduction = Math.min(weight / 2, 8)
      weights.set(symbol, Math.max(0, weight - reduction))
      weights.set(stableSymbol, (weights.get(stableSymbol) ?? 0) + reduction)
    }
  }

  return normalizeWeights(weights)
}

function resizeStableSleeve(weights: Map<string, number>, stableSymbol: string, desiredStableWeight: number) {
  const currentStableWeight = weights.get(stableSymbol) ?? 0
  const delta = desiredStableWeight - currentStableWeight
  if (Math.abs(delta) < 0.25) return

  const nonStableEntries = Array.from(weights.entries()).filter(([symbol, weight]) => symbol !== stableSymbol && weight > 0)
  const nonStableTotal = nonStableEntries.reduce((sum, [, weight]) => sum + weight, 0)
  if (nonStableTotal <= 0) return

  weights.set(stableSymbol, Math.max(0, desiredStableWeight))
  for (const [symbol, weight] of nonStableEntries) {
    weights.set(symbol, Math.max(0, weight - delta * (weight / nonStableTotal)))
  }
}

function momentum(pricesByDate: Map<string, number> | undefined, date: string, days: number) {
  if (!pricesByDate) return null
  const current = priceOnOrBefore(pricesByDate, date)
  const earlier = priceOnOrBefore(pricesByDate, shiftDate(date, -days))
  if (!current || !earlier) return null
  return current / earlier - 1
}

function averageDefined(values: Array<number | null>) {
  const filtered = values.filter((value): value is number => value !== null && Number.isFinite(value))
  if (!filtered.length) return null
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
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

function classifyProvider(series: HistoricalPriceSeries[]) {
  const sources = new Set(series.map((item) => item.source ?? "coinmarketcap"))
  if (sources.has("coinmarketcap") && sources.has("binance")) return "coinmarketcap+binance"
  if (sources.has("binance")) return "binance"
  return "coinmarketcap"
}

function providerLabel(provider: BacktestSummary["dataProvider"]) {
  if (provider === "binance") return "Binance kline"
  if (provider === "coinmarketcap+binance") return "CMC/Binance blended"
  return "CoinMarketCap historical quote"
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
