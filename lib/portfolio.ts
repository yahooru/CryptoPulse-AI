export type AssetRole =
  | "core"
  | "large-cap"
  | "stable"
  | "oracle"
  | "defi"
  | "layer-1"
  | "meme"
  | "cash"

export type AssetMeta = {
  symbol: string
  name: string
  cmcId: number
  sector: string
  role: AssetRole
  riskTier: 1 | 2 | 3 | 4 | 5
  bsc?: {
    address?: `0x${string}`
    decimals: number
    native?: boolean
  }
}

export type PortfolioInput = {
  symbol: string
  weight?: number
  amount?: number
  usdValue?: number
}

export type CmcQuote = {
  id: number
  name: string
  symbol: string
  cmc_rank?: number
  quote: {
    USD: {
      price: number
      market_cap?: number
      volume_24h?: number
      percent_change_1h?: number
      percent_change_24h?: number
      percent_change_7d?: number
      percent_change_30d?: number
      percent_change_60d?: number
      percent_change_90d?: number
      last_updated?: string
    }
  }
}

export type PortfolioPosition = {
  symbol: string
  name: string
  cmcId: number
  sector: string
  role: AssetRole
  weight: number
  amount?: number
  usdValue?: number
  price: number
  marketCap?: number
  rank?: number
  riskTier: number
  change24h: number
  change7d: number
  change30d: number
  change90d: number
  volumeToMarketCap: number
}

export type ExposureSlice = {
  label: string
  weight: number
}

export type Recommendation = {
  symbol: string
  action: "increase" | "reduce" | "hold" | "add"
  currentWeight: number
  targetWeight: number
  delta: number
  rationale: string
}

export type ExecutionIntent = {
  symbol: string
  side: "buy" | "sell" | "hold"
  deltaWeight: number
  fromWeight: number
  toWeight: number
  rationale: string
}

export type BacktestSummary = {
  method: "historical-replay" | "quote-window-proxy"
  dataProvider?: "coinmarketcap" | "binance" | "coinmarketcap+binance" | "quote-window"
  lookbackLabel: string
  currentReturn: number
  optimizedReturn: number
  currentDrawdownProxy: number
  optimizedDrawdownProxy: number
  benchmarkReturn?: number
  currentSharpe?: number
  optimizedSharpe?: number
  benchmarkSharpe?: number
  startDate?: string
  endDate?: string
  observations?: number
  turnoverCost?: number
  rebalanceEvents?: number
  dataCoverage?: {
    requestedAssets: number
    replayedAssets: number
    missingAssets: string[]
    coveragePct: number
  }
  dynamicRules?: string[]
  notes: string[]
}

export type AgentSignal = {
  agent: string
  status: "healthy" | "watch" | "risk"
  finding: string
  evidence: string
}

export type StrategySpec = {
  schemaVersion: "1.0.0"
  name: string
  uniqueName: string
  trackFit: string
  generatedAt: string
  objective: string
  dataSources: string[]
  universe: Array<{ symbol: string; cmcId: number; role: AssetRole }>
  targetAllocation: Array<{ symbol: string; weight: number }>
  signalRules: Array<{
    name: string
    description: string
    inputs: string[]
  }>
  rebalanceRules: string[]
  entryFilters: string[]
  exitFilters: string[]
  riskGuards: string[]
  execution: {
    mode: "simulation-only"
    intents: ExecutionIntent[]
    walletSafety: string[]
  }
  cmcSkill: {
    routingIntent: string
    inputSchemaPath: string
    requiredMcpTools: string[]
    optionalMcpTools: string[]
  }
  backtestConfig: {
    benchmark: string
    rebalance: string
    interval: "daily"
    lookbackDays: number
    transactionCostBps: number
    slippageBps: number
    maxAssetWeight: number
    maxMemeWeight: number
    maxDrawdown: number
  }
  reproducibility: {
    quoteCurrency: "USD"
    generatedFrom: "manual" | "bnb-chain"
    cmcIds: number[]
  }
}

export type AiNarrative = {
  thesis: string
  portfolioDoctorNote: string
  judgePitch: string
  riskDisclosure: string
}

export type PortfolioAnalysis = {
  generatedAt: string
  source: "manual" | "bnb-chain"
  healthScore: number
  riskScore: number
  diversificationScore: number
  marketRegime: string
  fearGreed?: {
    value: number
    classification: string
  }
  totalWeight: number
  positions: PortfolioPosition[]
  sectorExposure: ExposureSlice[]
  roleExposure: ExposureSlice[]
  recommendations: Recommendation[]
  backtest: BacktestSummary
  agentSignals: AgentSignal[]
  strategySpec: StrategySpec
  ai?: AiNarrative | null
  aiStatus?: string
}

export const DEFAULT_PORTFOLIO_TEXT = ""

export const ASSET_CATALOG: AssetMeta[] = [
  { symbol: "BTC", name: "Bitcoin", cmcId: 1, sector: "Store of value", role: "core", riskTier: 2, bsc: { address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", decimals: 18 } },
  { symbol: "ETH", name: "Ethereum", cmcId: 1027, sector: "Smart contracts", role: "core", riskTier: 2, bsc: { address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", decimals: 18 } },
  { symbol: "BNB", name: "BNB", cmcId: 1839, sector: "BNB Chain", role: "core", riskTier: 2, bsc: { decimals: 18, native: true } },
  { symbol: "SOL", name: "Solana", cmcId: 5426, sector: "Smart contracts", role: "large-cap", riskTier: 3 },
  { symbol: "XRP", name: "XRP", cmcId: 52, sector: "Payments", role: "large-cap", riskTier: 3 },
  { symbol: "ADA", name: "Cardano", cmcId: 2010, sector: "Smart contracts", role: "large-cap", riskTier: 3 },
  { symbol: "AVAX", name: "Avalanche", cmcId: 5805, sector: "Smart contracts", role: "large-cap", riskTier: 3 },
  { symbol: "LINK", name: "Chainlink", cmcId: 1975, sector: "Oracle", role: "oracle", riskTier: 3, bsc: { address: "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD", decimals: 18 } },
  { symbol: "CAKE", name: "PancakeSwap", cmcId: 7186, sector: "DeFi", role: "defi", riskTier: 4, bsc: { address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", decimals: 18 } },
  { symbol: "USDT", name: "Tether USDt", cmcId: 825, sector: "Stablecoin", role: "stable", riskTier: 1, bsc: { address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 } },
  { symbol: "USDC", name: "USDC", cmcId: 3408, sector: "Stablecoin", role: "stable", riskTier: 1, bsc: { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 } },
  { symbol: "DOGE", name: "Dogecoin", cmcId: 74, sector: "Meme", role: "meme", riskTier: 5, bsc: { address: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43", decimals: 8 } },
  { symbol: "SHIB", name: "Shiba Inu", cmcId: 5994, sector: "Meme", role: "meme", riskTier: 5 },
  { symbol: "PEPE", name: "Pepe", cmcId: 24478, sector: "Meme", role: "meme", riskTier: 5 },
]

export const CATALOG_BY_SYMBOL = new Map(ASSET_CATALOG.map((asset) => [asset.symbol, asset]))
export const CATALOG_BY_ID = new Map(ASSET_CATALOG.map((asset) => [asset.cmcId, asset]))
const PORTFOLIO_ROW_PATTERN = /^([a-zA-Z0-9.-]+)\s*(?::|-)?\s*([$]?[0-9][0-9.,]*)?\s*%?$/

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function parsePortfolioText(text: string): PortfolioInput[] {
  return parsePortfolioTextDetailed(text).inputs
}

export function parsePortfolioTextDetailed(text: string): {
  inputs: PortfolioInput[]
  invalidRows: string[]
} {
  const rows = text
    .split(/\r?\n|,/)
    .map((row) => row.trim())
    .filter(Boolean)

  const invalidRows: string[] = []
  const inputs = rows
    .map<PortfolioInput | null>((row) => {
      const match = row.match(PORTFOLIO_ROW_PATTERN)
      if (!match) {
        invalidRows.push(row)
        return null
      }

      const symbol = match[1].toUpperCase()
      const rawValue = match[2]?.replace(/[$,]/g, "")
      const weight = rawValue ? Number(rawValue) : undefined
      if (rawValue && !Number.isFinite(weight)) {
        invalidRows.push(row)
        return null
      }

      const input: PortfolioInput = {
        symbol,
        weight: Number.isFinite(weight) ? weight : undefined,
      }
      return input
    })
    .filter((entry): entry is PortfolioInput => entry !== null)

  return { inputs, invalidRows }
}

export function normalizePortfolioInputs(inputs: PortfolioInput[]): PortfolioInput[] {
  const cleaned = aggregatePortfolioInputs(
    inputs
      .map((input) => ({
        ...input,
        symbol: input.symbol.toUpperCase().trim(),
        weight: Number.isFinite(input.weight) ? Math.max(0, Number(input.weight)) : undefined,
        amount: Number.isFinite(input.amount) ? Math.max(0, Number(input.amount)) : undefined,
        usdValue: Number.isFinite(input.usdValue) ? Math.max(0, Number(input.usdValue)) : undefined,
      }))
      .filter((input) => input.symbol),
  )

  const usdTotal = cleaned.reduce((sum, input) => sum + (input.usdValue ?? 0), 0)
  if (usdTotal > 0) {
    return cleaned.map((input) => ({
      ...input,
      weight: ((input.usdValue ?? 0) / usdTotal) * 100,
    }))
  }

  const explicitTotal = cleaned.reduce((sum, input) => sum + (input.weight ?? 0), 0)
  if (explicitTotal > 0) {
    return cleaned.map((input) => ({
      ...input,
      weight: ((input.weight ?? 0) / explicitTotal) * 100,
    }))
  }

  const equalWeight = cleaned.length ? 100 / cleaned.length : 0
  return cleaned.map((input) => ({ ...input, weight: equalWeight }))
}

function aggregatePortfolioInputs(inputs: PortfolioInput[]) {
  const bySymbol = new Map<string, PortfolioInput>()
  for (const input of inputs) {
    const existing = bySymbol.get(input.symbol)
    if (!existing) {
      bySymbol.set(input.symbol, { ...input })
      continue
    }
    if (existing.weight !== undefined || input.weight !== undefined) {
      existing.weight = (existing.weight ?? 0) + (input.weight ?? 0)
    }
    if (existing.amount !== undefined || input.amount !== undefined) {
      existing.amount = (existing.amount ?? 0) + (input.amount ?? 0)
    }
    if (existing.usdValue !== undefined || input.usdValue !== undefined) {
      existing.usdValue = (existing.usdValue ?? 0) + (input.usdValue ?? 0)
    }
  }
  return Array.from(bySymbol.values())
}

export function getReturnWindow(position: PortfolioPosition) {
  if (Number.isFinite(position.change90d) && position.change90d !== 0) return position.change90d
  if (Number.isFinite(position.change30d) && position.change30d !== 0) return position.change30d
  return position.change7d
}

export function buildPortfolioAnalysis(params: {
  inputs: PortfolioInput[]
  quotes: CmcQuote[]
  fearGreed?: { value: number; classification: string }
  source?: "manual" | "bnb-chain"
}): PortfolioAnalysis {
  const normalized = normalizePortfolioInputs(params.inputs)
  const quotesBySymbol = new Map(params.quotes.map((quote) => [quote.symbol.toUpperCase(), quote]))
  const positions: PortfolioPosition[] = normalized
    .map<PortfolioPosition | null>((input) => {
      const quote = quotesBySymbol.get(input.symbol)
      if (!quote) return null

      const meta = CATALOG_BY_SYMBOL.get(input.symbol) ?? {
        symbol: input.symbol,
        name: quote.name,
        cmcId: quote.id,
        sector: "Unclassified",
        role: "large-cap" as AssetRole,
        riskTier: 4 as const,
      }
      const usd = quote.quote.USD
      const marketCap = usd.market_cap ?? 0
      const volume = usd.volume_24h ?? 0
      const volumeToMarketCap = marketCap > 0 ? volume / marketCap : 0

      const position: PortfolioPosition = {
        symbol: input.symbol,
        name: quote.name || meta.name,
        cmcId: quote.id,
        sector: meta.sector,
        role: meta.role,
        weight: input.weight ?? 0,
        amount: input.amount,
        usdValue: input.usdValue,
        price: usd.price,
        marketCap,
        rank: quote.cmc_rank,
        riskTier: meta.riskTier,
        change24h: usd.percent_change_24h ?? 0,
        change7d: usd.percent_change_7d ?? 0,
        change30d: usd.percent_change_30d ?? 0,
        change90d: usd.percent_change_90d ?? usd.percent_change_60d ?? usd.percent_change_30d ?? 0,
        volumeToMarketCap,
      }
      return position
    })
    .filter((position): position is PortfolioPosition => position !== null)

  const totalWeight = positions.reduce((sum, position) => sum + position.weight, 0)
  const maxWeight = positions.reduce((max, position) => Math.max(max, position.weight), 0)
  const memeExposure = sumByRole(positions, "meme")
  const stableExposure = sumByRole(positions, "stable")
  const coreExposure = positions
    .filter((position) => position.role === "core")
    .reduce((sum, position) => sum + position.weight, 0)
  const highRiskExposure = positions
    .filter((position) => position.riskTier >= 4)
    .reduce((sum, position) => sum + position.weight, 0)

  const volatilityProxy = positions.reduce((sum, position) => {
    const movement = Math.abs(position.change24h) * 1.2 + Math.abs(position.change7d) * 0.55 + position.riskTier * 8
    return sum + (position.weight / 100) * movement
  }, 0)

  const concentrationPenalty = clamp(maxWeight - 30, 0, 35)
  const memePenalty = clamp(memeExposure - 8, 0, 30)
  const highRiskPenalty = clamp(highRiskExposure - 25, 0, 25)
  const stableBuffer = clamp(stableExposure, 0, 18) * 0.35
  const coreBuffer = clamp(coreExposure, 0, 65) * 0.18

  const riskScore = clamp(Math.round(volatilityProxy + concentrationPenalty + highRiskPenalty + memePenalty * 0.5), 0, 100)
  const diversificationScore = clamp(Math.round(100 - concentrationPenalty * 1.4 - Math.max(0, 5 - positions.length) * 7 - memePenalty), 0, 100)
  const healthScore = clamp(Math.round(100 - riskScore * 0.45 - concentrationPenalty - memePenalty + stableBuffer + coreBuffer), 0, 100)

  const marketRegime = classifyMarketRegime(params.fearGreed, positions)
  const targetWeights = buildTargetWeights(positions, params.fearGreed)
  const recommendations = buildRecommendations(positions, targetWeights)
  const backtest = buildBacktestSummary(positions, targetWeights, quotesBySymbol)
  const agentSignals = buildAgentSignals({
    positions,
    healthScore,
    riskScore,
    diversificationScore,
    maxWeight,
    memeExposure,
    stableExposure,
    marketRegime,
  })

  return {
    generatedAt: new Date().toISOString(),
    source: params.source ?? "manual",
    healthScore,
    riskScore,
    diversificationScore,
    marketRegime,
    fearGreed: params.fearGreed,
    totalWeight: round(totalWeight),
    positions,
    sectorExposure: groupExposure(positions, "sector"),
    roleExposure: groupExposure(positions, "role"),
    recommendations,
    backtest,
    agentSignals,
    strategySpec: buildStrategySpec(positions, targetWeights, params.source ?? "manual"),
    ai: null,
  }
}

function sumByRole(positions: PortfolioPosition[], role: AssetRole) {
  return positions.filter((position) => position.role === role).reduce((sum, position) => sum + position.weight, 0)
}

function groupExposure(positions: PortfolioPosition[], key: "sector" | "role"): ExposureSlice[] {
  const map = new Map<string, number>()
  for (const position of positions) {
    const label = position[key]
    map.set(label, (map.get(label) ?? 0) + position.weight)
  }

  return Array.from(map.entries())
    .map(([label, weight]) => ({ label, weight: round(weight) }))
    .sort((a, b) => b.weight - a.weight)
}

function classifyMarketRegime(fearGreed: PortfolioAnalysis["fearGreed"], positions: PortfolioPosition[]) {
  const btc = positions.find((position) => position.symbol === "BTC")
  const eth = positions.find((position) => position.symbol === "ETH")
  const anchorMomentum = ((btc?.change7d ?? 0) + (eth?.change7d ?? 0)) / (btc && eth ? 2 : 1)

  if (fearGreed) {
    if (fearGreed.value >= 75 && anchorMomentum > 0) return "Risk-on, greed elevated"
    if (fearGreed.value <= 30 && anchorMomentum < 0) return "Defensive, fear elevated"
    if (fearGreed.value >= 60) return "Constructive with crowded sentiment"
    if (fearGreed.value <= 40) return "Cautious accumulation"
  }

  if (anchorMomentum > 6) return "Momentum-led expansion"
  if (anchorMomentum < -6) return "Risk-off compression"
  return "Balanced rotation"
}

function buildTargetWeights(positions: PortfolioPosition[], fearGreed?: PortfolioAnalysis["fearGreed"]) {
  const target = new Map<string, number>()
  const held = new Set(positions.map((position) => position.symbol))
  const sentiment = fearGreed?.value ?? 50
  const stableWeight = sentiment > 72 ? 12 : sentiment < 35 ? 22 : 15
  const coreWeight = sentiment < 35 ? 68 : 72
  const satelliteWeight = 100 - stableWeight - coreWeight

  target.set("BTC", coreWeight * 0.52)
  target.set("ETH", coreWeight * 0.32)
  target.set("BNB", coreWeight * 0.16)

  const stableSymbol = held.has("USDC") && !held.has("USDT") ? "USDC" : "USDT"
  target.set(stableSymbol, stableWeight)

  const satellite = held.has("SOL") ? "SOL" : held.has("CAKE") ? "CAKE" : "LINK"
  target.set(satellite, satelliteWeight)

  for (const position of positions) {
    if (position.role === "meme") {
      target.set(position.symbol, Math.min(target.get(position.symbol) ?? 0, 3))
    }
    if (position.role === "defi" && !target.has(position.symbol)) {
      target.set(position.symbol, Math.min(position.weight, 5))
    }
  }

  const total = Array.from(target.values()).reduce((sum, value) => sum + value, 0)
  if (total === 0) return target

  for (const [symbol, weight] of target.entries()) {
    target.set(symbol, round((weight / total) * 100))
  }

  return target
}

export function recommendedQuoteSymbolsForInputs(inputs: PortfolioInput[]) {
  const held = new Set(inputs.map((input) => input.symbol.toUpperCase()))
  const stableSymbol = held.has("USDC") && !held.has("USDT") ? "USDC" : "USDT"
  const satellite = held.has("SOL") ? "SOL" : held.has("CAKE") ? "CAKE" : "LINK"
  return ["BTC", "ETH", "BNB", stableSymbol, satellite]
}

function buildRecommendations(positions: PortfolioPosition[], targets: Map<string, number>): Recommendation[] {
  const currentMap = new Map(positions.map((position) => [position.symbol, position]))
  const symbols = new Set([...positions.map((position) => position.symbol), ...targets.keys()])

  return Array.from(symbols)
    .map((symbol) => {
      const current = currentMap.get(symbol)
      const currentWeight = current?.weight ?? 0
      const targetWeight = targets.get(symbol) ?? 0
      const delta = round(targetWeight - currentWeight)
      const meta = CATALOG_BY_SYMBOL.get(symbol)
      const action: Recommendation["action"] =
        currentWeight === 0 && targetWeight > 0 ? "add" : delta > 2 ? "increase" : delta < -2 ? "reduce" : "hold"

      return {
        symbol,
        action,
        currentWeight: round(currentWeight),
        targetWeight: round(targetWeight),
        delta,
        rationale: recommendationReason(symbol, action, current, meta),
      }
    })
    .filter((item) => Math.abs(item.delta) >= 0.5 || item.action === "hold")
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

function recommendationReason(
  symbol: string,
  action: Recommendation["action"],
  current?: PortfolioPosition,
  meta?: AssetMeta,
) {
  if (action === "add") return `${symbol} improves the strategy universe for the backtest and reduces single-theme exposure.`
  if (action === "increase") return `${symbol} is part of the core allocation target for a more durable BNB Hack strategy spec.`
  if (action === "reduce" && current?.role === "meme") return `${symbol} is capped because meme exposure can dominate drawdown in risk-off windows.`
  if (action === "reduce") return `${symbol} is above its risk-adjusted target and should be rebalanced into core or stable exposure.`
  return `${symbol} stays close to target as a ${meta?.role ?? current?.role ?? "portfolio"} sleeve.`
}

function buildBacktestSummary(
  positions: PortfolioPosition[],
  targets: Map<string, number>,
  quotesBySymbol: Map<string, CmcQuote>,
): BacktestSummary {
  const currentReturn = positions.reduce((sum, position) => sum + (position.weight / 100) * getReturnWindow(position), 0)
  const positionMap = new Map(positions.map((position) => [position.symbol, position]))
  const optimizedReturn = Array.from(targets.entries()).reduce((sum, [symbol, weight]) => {
    const position = positionMap.get(symbol)
    return sum + (weight / 100) * (position ? getReturnWindow(position) : getReturnWindowFromQuote(quotesBySymbol.get(symbol)))
  }, 0)
  const currentDrawdownProxy = positions.reduce(
    (sum, position) => sum + (position.weight / 100) * Math.min(0, position.change7d, position.change30d),
    0,
  )
  const optimizedDrawdownProxy = Array.from(targets.entries()).reduce((sum, [symbol, weight]) => {
    const position = positionMap.get(symbol)
    const quote = quotesBySymbol.get(symbol)
    return sum + (weight / 100) * (position ? Math.min(0, position.change7d, position.change30d) : getDrawdownProxyFromQuote(quote))
  }, 0)

  return {
    method: "quote-window-proxy",
    lookbackLabel: "CMC quote windows, preferring 90d then 30d then 7d",
    currentReturn: round(currentReturn),
    optimizedReturn: round(optimizedReturn),
    currentDrawdownProxy: round(currentDrawdownProxy),
    optimizedDrawdownProxy: round(optimizedDrawdownProxy),
    notes: [
      "The UI produces a backtestable strategy spec; a full runner can replay the same universe with CMC historical OHLCV.",
      "Transaction cost and slippage assumptions are included in the exported spec for judge reproducibility.",
      "No live execution is triggered; Track 2 asks for strategy skills, not a live-trading agent.",
    ],
  }
}

function getReturnWindowFromQuote(quote?: CmcQuote) {
  const usd = quote?.quote.USD
  if (!usd) return 0
  if (Number.isFinite(usd.percent_change_90d) && usd.percent_change_90d !== 0) return usd.percent_change_90d ?? 0
  if (Number.isFinite(usd.percent_change_30d) && usd.percent_change_30d !== 0) return usd.percent_change_30d ?? 0
  return usd.percent_change_7d ?? 0
}

function getDrawdownProxyFromQuote(quote?: CmcQuote) {
  const usd = quote?.quote.USD
  if (!usd) return 0
  return Math.min(0, usd.percent_change_7d ?? 0, usd.percent_change_30d ?? 0)
}

function buildAgentSignals(params: {
  positions: PortfolioPosition[]
  healthScore: number
  riskScore: number
  diversificationScore: number
  maxWeight: number
  memeExposure: number
  stableExposure: number
  marketRegime: string
}): AgentSignal[] {
  const top = [...params.positions].sort((a, b) => b.weight - a.weight)[0]
  return [
    {
      agent: "Portfolio Analysis Agent",
      status: params.diversificationScore >= 70 ? "healthy" : params.diversificationScore >= 45 ? "watch" : "risk",
      finding: params.maxWeight > 35 ? "Single asset concentration is the main portfolio drag." : "Allocation breadth is acceptable for a concentrated crypto portfolio.",
      evidence: top ? `${top.symbol} is ${round(top.weight)}% of the portfolio.` : "No positions supplied.",
    },
    {
      agent: "Risk Agent",
      status: params.riskScore > 70 ? "risk" : params.riskScore > 45 ? "watch" : "healthy",
      finding: params.memeExposure > 12 ? "Speculative exposure needs a hard cap before backtesting." : "Volatility budget is inside the default guardrail.",
      evidence: `Risk score ${params.riskScore}/100 with meme exposure at ${round(params.memeExposure)}%.`,
    },
    {
      agent: "Market Agent",
      status: params.marketRegime.includes("fear") || params.marketRegime.includes("Risk-off") ? "watch" : "healthy",
      finding: params.marketRegime,
      evidence: "Regime blends CMC sentiment with BTC/ETH momentum when both anchors are available.",
    },
    {
      agent: "Portfolio Optimizer",
      status: params.healthScore >= 75 ? "healthy" : "watch",
      finding: "Rebalance target favors BTC, ETH, BNB, one satellite sleeve, and a stable buffer.",
      evidence: `Health score ${params.healthScore}/100 after concentration, sector, and drawdown penalties.`,
    },
  ]
}

function buildStrategySpec(
  positions: PortfolioPosition[],
  targetWeights: Map<string, number>,
  source: "manual" | "bnb-chain",
): StrategySpec {
  const positionBySymbol = new Map(positions.map((position) => [position.symbol, position]))
  const universe = Array.from(new Set([...positions.map((position) => position.symbol), ...targetWeights.keys()]))
    .map((symbol) => {
      const position = positionBySymbol.get(symbol)
      const meta = CATALOG_BY_SYMBOL.get(symbol)
      const cmcId = position?.cmcId ?? meta?.cmcId
      const role = position?.role ?? meta?.role
      if (!cmcId || !role) return null
      return { symbol, cmcId, role }
    })
    .filter((asset): asset is { symbol: string; cmcId: number; role: AssetRole } => asset !== null)
  const targetAllocation = Array.from(targetWeights.entries())
    .map(([symbol, weight]) => ({ symbol, weight: round(weight) }))
    .filter((item) => item.weight > 0)
    .sort((a, b) => b.weight - a.weight)

  return {
    schemaVersion: "1.0.0",
    name: "CryptoPulse AI Portfolio Doctor Skill",
    uniqueName: "cryptopulse_portfolio_doctor",
    trackFit: "BNB Hack Track 2: CMC Strategy Skill that emits a reproducible, backtestable allocation spec.",
    generatedAt: new Date().toISOString(),
    objective: "Convert a crypto portfolio into a risk-aware allocation strategy using CMC market data and BNB Chain portfolio reads.",
    dataSources: [
      "CoinMarketCap quotes/latest for price, market cap, volume, and return windows",
      "CoinMarketCap Fear and Greed latest for sentiment regime",
      "BNB Smart Chain JSON-RPC for wallet balances when the user connects a wallet",
      "OpenAI Responses API for structured reasoning notes when configured",
    ],
    universe,
    targetAllocation,
    signalRules: [
      {
        name: "core_momentum_anchor",
        description: "BTC, ETH, and BNB remain eligible core sleeves unless their CMC quote momentum is unavailable.",
        inputs: ["CMC quotes 7d/30d/90d percent changes", "CMC rank", "CMC market cap"],
      },
      {
        name: "sentiment_stable_buffer",
        description: "CMC Fear and Greed controls the stablecoin reserve between defensive and risk-on regimes.",
        inputs: ["CMC Fear and Greed latest", "portfolio risk score"],
      },
      {
        name: "satellite_liquidity_filter",
        description: "Non-core satellite sleeves must pass momentum and volume-to-market-cap liquidity checks.",
        inputs: ["CMC quotes volume_24h", "CMC market_cap", "30d/90d momentum"],
      },
      {
        name: "speculative_sleeve_cap",
        description: "Meme and tier-4/5 assets are capped before replay so drawdown does not dominate the strategy.",
        inputs: ["local risk tier", "role exposure", "recent drawdown proxy"],
      },
    ],
    rebalanceRules: [
      "Rebalance weekly or when any sleeve drifts more than 5 percentage points from target.",
      "Keep meme exposure below 8 percent unless the strategy is explicitly switched to high-risk mode.",
      "Keep a stablecoin reserve between 12 and 22 percent depending on CMC Fear and Greed.",
    ],
    entryFilters: [
      "Prefer assets with positive 30d or 90d CMC momentum unless the asset is BTC, ETH, or BNB core exposure.",
      "Require volume-to-market-cap liquidity above 1 percent for non-stable satellite sleeves.",
      "Do not add assets missing a stable CMC id in the strategy spec.",
    ],
    exitFilters: [
      "Reduce assets that exceed target by more than 5 percentage points.",
      "Reduce high-risk sleeves after a 7d loss worse than the portfolio average.",
      "Move excess high-risk exposure into the stable sleeve during fear regimes.",
    ],
    riskGuards: [
      "Maximum single asset weight: 45 percent.",
      "Maximum high-risk sleeve weight: 25 percent.",
      "Maximum meme sleeve weight: 8 percent.",
      "Fail the strategy if drawdown proxy breaches -18 percent during replay.",
    ],
    execution: {
      mode: "simulation-only",
      intents: buildExecutionIntents(positions, targetAllocation, new Map(recommendationsFromTargets(positions, targetWeights).map((item) => [item.symbol, item.rationale]))),
      walletSafety: [
        "No private keys are requested.",
        "No wallet transaction, token approval, or swap is submitted.",
        "Trade intents are simulation tickets that can be reviewed before using any external execution venue.",
      ],
    },
    cmcSkill: {
      routingIntent: "portfolio allocation diagnosis, risk-aware rebalance strategy, and backtestable strategy spec generation",
      inputSchemaPath: "skills/cryptopulse-portfolio-doctor/input.schema.json",
      requiredMcpTools: [
        "search_cryptos",
        "get_crypto_quotes_latest",
        "get_global_metrics_latest",
      ],
      optionalMcpTools: [
        "get_crypto_technical_analysis",
        "get_crypto_latest_news",
        "get_global_crypto_derivatives_metrics",
        "trending_crypto_narratives",
      ],
    },
    backtestConfig: {
      benchmark: "50% BTC, 30% ETH, 10% BNB, 10% stablecoin",
      rebalance: "weekly close",
      interval: "daily",
      lookbackDays: 120,
      transactionCostBps: 15,
      slippageBps: 10,
      maxAssetWeight: 45,
      maxMemeWeight: 8,
      maxDrawdown: -18,
    },
    reproducibility: {
      quoteCurrency: "USD",
      generatedFrom: source,
      cmcIds: universe.map((asset) => asset.cmcId),
    },
  }
}

function recommendationsFromTargets(positions: PortfolioPosition[], targets: Map<string, number>) {
  return buildRecommendations(positions, targets)
}

function buildExecutionIntents(
  positions: PortfolioPosition[],
  targetAllocation: Array<{ symbol: string; weight: number }>,
  rationaleBySymbol: Map<string, string>,
): ExecutionIntent[] {
  const currentBySymbol = new Map(positions.map((position) => [position.symbol, position.weight]))
  const symbols = new Set([...currentBySymbol.keys(), ...targetAllocation.map((item) => item.symbol)])

  return Array.from(symbols)
    .map((symbol) => {
      const fromWeight = round(currentBySymbol.get(symbol) ?? 0)
      const toWeight = round(targetAllocation.find((item) => item.symbol === symbol)?.weight ?? 0)
      const deltaWeight = round(toWeight - fromWeight)
      const side: ExecutionIntent["side"] = deltaWeight > 0.5 ? "buy" : deltaWeight < -0.5 ? "sell" : "hold"
      return {
        symbol,
        side,
        deltaWeight,
        fromWeight,
        toWeight,
        rationale: rationaleBySymbol.get(symbol) ?? "Keep this sleeve close to the generated strategy target.",
      }
    })
    .filter((intent) => Math.abs(intent.deltaWeight) >= 0.5 || intent.side === "hold")
    .sort((a, b) => Math.abs(b.deltaWeight) - Math.abs(a.deltaWeight))
}
