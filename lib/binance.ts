import type { HistoricalPriceSeries } from "@/lib/backtest"
import { CATALOG_BY_SYMBOL } from "@/lib/portfolio"
import { fetchWithTimeout } from "@/lib/fetch-timeout"

const BINANCE_BASE_URL = "https://api.binance.com"
const BINANCE_SYMBOL_BY_ASSET = new Map<string, string>([
  ["BTC", "BTCUSDT"],
  ["ETH", "ETHUSDT"],
  ["BNB", "BNBUSDT"],
  ["SOL", "SOLUSDT"],
  ["XRP", "XRPUSDT"],
  ["ADA", "ADAUSDT"],
  ["AVAX", "AVAXUSDT"],
  ["LINK", "LINKUSDT"],
  ["CAKE", "CAKEUSDT"],
  ["DOGE", "DOGEUSDT"],
  ["SHIB", "SHIBUSDT"],
  ["PEPE", "PEPEUSDT"],
])

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
]

export async function fetchBinanceDailyKlinesForSymbols(symbols: string[], count = 120) {
  const uniqueSymbols = Array.from(new Set(symbols.map((symbol) => symbol.toUpperCase())))
  const results = await Promise.allSettled(
    uniqueSymbols.map(async (symbol) => fetchBinanceDailyKlines(symbol, count)),
  )

  const series: HistoricalPriceSeries[] = []
  const errors: Array<{ symbol: string; message: string }> = []

  results.forEach((result, index) => {
    const symbol = uniqueSymbols[index]
    if (result.status === "fulfilled") {
      if (result.value) series.push(result.value)
      return
    }
    errors.push({
      symbol,
      message: result.reason instanceof Error ? result.reason.message : "Binance daily candles unavailable.",
    })
  })

  return { series, errors }
}

async function fetchBinanceDailyKlines(symbol: string, count: number): Promise<HistoricalPriceSeries | null> {
  if (isStable(symbol)) return null
  const marketSymbol = BINANCE_SYMBOL_BY_ASSET.get(symbol)
  if (!marketSymbol) return null

  const url = new URL("/api/v3/klines", BINANCE_BASE_URL)
  url.searchParams.set("symbol", marketSymbol)
  url.searchParams.set("interval", "1d")
  url.searchParams.set("limit", String(Math.max(30, Math.min(1000, count))))

  const response = await fetchWithTimeout(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3_600 },
  }, 12_000, "Binance daily klines")

  if (!response.ok) {
    throw new Error(`Binance ${marketSymbol} klines failed with HTTP ${response.status}.`)
  }

  const raw = (await response.json()) as BinanceKline[]
  const points = raw
    .map((kline) => {
      const timestamp = Number(kline[0])
      const close = Number(kline[4])
      if (!Number.isFinite(timestamp) || !Number.isFinite(close) || close <= 0) return null
      return {
        timestamp: new Date(timestamp).toISOString(),
        price: close,
      }
    })
    .filter((point): point is { timestamp: string; price: number } => point !== null)

  if (points.length < 20) return null

  return {
    cmcId: CATALOG_BY_SYMBOL.get(symbol)?.cmcId ?? 0,
    symbol,
    source: "binance",
    points,
  }
}

function isStable(symbol: string) {
  return ["USDT", "USDC", "DAI", "FDUSD"].includes(symbol.toUpperCase())
}
