import { ASSET_CATALOG, CATALOG_BY_SYMBOL, type CmcQuote } from "@/lib/portfolio"
import { fetchWithTimeout } from "@/lib/fetch-timeout"
import type { HistoricalPriceSeries } from "@/lib/backtest"

const CMC_BASE_URL = process.env.CMC_API_BASE_URL ?? "https://pro-api.coinmarketcap.com"
const CACHE_TTL_MS = 60_000

type CacheEntry = {
  expiresAt: number
  data: unknown
}

const cache = new Map<string, CacheEntry>()

export type FearGreed = {
  value: number
  classification: string
}

type CmcQuotePayload = Omit<CmcQuote, "quote"> & {
  quote?: CmcQuote["quote"] | CmcQuote["quote"]["USD"][]
}

type CmcHistoricalPayload = {
  id?: number
  name?: string
  symbol?: string
  quotes?: Array<{
    timestamp?: string
    quote?: {
      USD?: {
        price?: number
        timestamp?: string
      }
    }
  }>
}

export class CmcApiError extends Error {
  status: number
  code?: number

  constructor(message: string, status: number, code?: number) {
    super(message)
    this.name = "CmcApiError"
    this.status = status
    this.code = code
  }
}

export function getCmcApiKey() {
  return process.env.COINMARKETCAP_API_KEY || process.env.CMC_API_KEY
}

export async function resolveCmcIds(symbols: string[]) {
  const uniqueSymbols = Array.from(new Set(symbols.map((symbol) => symbol.toUpperCase())))
  const resolved = new Map<string, number>()
  const unresolved: string[] = []

  for (const symbol of uniqueSymbols) {
    const local = CATALOG_BY_SYMBOL.get(symbol)
    if (local) {
      resolved.set(symbol, local.cmcId)
    } else {
      unresolved.push(symbol)
    }
  }

  if (!unresolved.length) return resolved

  const mapped = await cmcGet<{ data?: Array<{ id: number; symbol: string; rank?: number }> }>("/v1/cryptocurrency/map", {
    symbol: unresolved.join(","),
  })

  const bestBySymbol = new Map<string, { id: number; symbol: string; rank?: number }>()
  for (const asset of mapped.data ?? []) {
    const symbol = asset.symbol.toUpperCase()
    if (!unresolved.includes(symbol)) continue
    const current = bestBySymbol.get(symbol)
    const currentRank = current?.rank ?? Number.MAX_SAFE_INTEGER
    const candidateRank = asset.rank ?? Number.MAX_SAFE_INTEGER
    if (!current || candidateRank < currentRank) {
      bestBySymbol.set(symbol, asset)
    }
  }

  for (const [symbol, asset] of bestBySymbol.entries()) {
    resolved.set(symbol, asset.id)
  }

  return resolved
}

export async function fetchCmcQuotes(ids: number[]) {
  const uniqueIds = Array.from(new Set(ids)).filter(Boolean)
  if (!uniqueIds.length) return []

  const payload = await cmcGet<{ data?: CmcQuotePayload[] | Record<string, CmcQuotePayload> }>("/v3/cryptocurrency/quotes/latest", {
    id: uniqueIds.join(","),
    convert: "USD",
  })

  const data = payload.data
  const quotes = Array.isArray(data) ? data : data && typeof data === "object" ? Object.values(data) : []
  return quotes.map(normalizeQuotePayload).filter((quote): quote is CmcQuote => quote !== null)
}

function normalizeQuotePayload(payload: CmcQuotePayload): CmcQuote | null {
  const rawQuote = payload.quote
  const usd = Array.isArray(rawQuote) ? rawQuote[0] : rawQuote?.USD
  if (!usd || typeof usd.price !== "number") return null

  return {
    ...payload,
    quote: {
      USD: usd,
    },
  }
}

export async function fetchFearGreedLatest(): Promise<FearGreed | undefined> {
  try {
    const payload = await cmcGet<{ data?: { value?: string | number; value_classification?: string } }>(
      "/v3/fear-and-greed/latest",
      {},
    )
    const value = Number(payload.data?.value)
    if (!Number.isFinite(value)) return undefined
    return {
      value,
      classification: payload.data?.value_classification ?? "Neutral",
    }
  } catch (error) {
    if (error instanceof CmcApiError && [403, 429].includes(error.status)) return undefined
    throw error
  }
}

export async function fetchQuotesForSymbols(symbols: string[]) {
  const idsBySymbol = await resolveCmcIds(symbols)
  const ids = symbols
    .map((symbol) => idsBySymbol.get(symbol.toUpperCase()))
    .filter((id): id is number => Number.isFinite(id))
  const quotes = await fetchCmcQuotes(ids)

  return quotes.map((quote) => {
    const local = ASSET_CATALOG.find((asset) => asset.cmcId === quote.id)
    return {
      ...quote,
      symbol: (local?.symbol ?? quote.symbol).toUpperCase(),
      name: quote.name ?? local?.name ?? quote.symbol,
    }
  })
}

export async function fetchHistoricalQuotesForIds(ids: number[], count = 120) {
  const uniqueIds = Array.from(new Set(ids)).filter(Boolean)
  const results = await Promise.allSettled(
    uniqueIds.map(async (id) => {
      const payload = await cmcGet<{ data?: CmcHistoricalPayload }>("/v3/cryptocurrency/quotes/historical", {
        id,
        convert: "USD",
        interval: "daily",
        count: Math.max(30, Math.min(365, count)),
        aux: "price,quote_timestamp",
      })

      return normalizeHistoricalPayload(payload.data, id)
    }),
  )

  const series: HistoricalPriceSeries[] = []
  const errors: Array<{ id: number; message: string }> = []

  results.forEach((result, index) => {
    const id = uniqueIds[index]
    if (result.status === "fulfilled") {
      if (result.value) series.push(result.value)
      return
    }
    errors.push({
      id,
      message: result.reason instanceof Error ? result.reason.message : "Historical quotes unavailable.",
    })
  })

  return { series, errors }
}

function normalizeHistoricalPayload(payload: CmcHistoricalPayload | undefined, fallbackId: number): HistoricalPriceSeries | null {
  const quotes = payload?.quotes ?? []
  const points = quotes
    .map((item) => {
      const price = item.quote?.USD?.price
      const timestamp = item.quote?.USD?.timestamp ?? item.timestamp
      if (!timestamp || !Number.isFinite(price)) return null
      return {
        timestamp,
        price: Number(price),
      }
    })
    .filter((point): point is { timestamp: string; price: number } => point !== null)

  if (points.length < 2) return null

  const symbol = (payload?.symbol ?? CATALOG_BY_ID_SYMBOL.get(fallbackId) ?? String(fallbackId)).toUpperCase()
  return {
    cmcId: payload?.id ?? fallbackId,
    symbol,
    points,
  }
}

const CATALOG_BY_ID_SYMBOL = new Map(ASSET_CATALOG.map((asset) => [asset.cmcId, asset.symbol]))

async function cmcGet<T>(path: string, params: Record<string, string | number | undefined>) {
  const apiKey = getCmcApiKey()
  if (!apiKey) {
    throw new CmcApiError("CoinMarketCap API key is not configured.", 401, 1002)
  }

  const url = new URL(path, CMC_BASE_URL)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value))
    }
  }

  const cacheKey = url.toString()
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T
  }

  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, {
        headers: {
          Accept: "application/json",
          "X-CMC_PRO_API_KEY": apiKey,
        },
        next: { revalidate: 60 },
      }, 12_000, "CoinMarketCap")
      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = json?.status?.error_message || `CoinMarketCap request failed with HTTP ${response.status}.`
        throw new CmcApiError(message, response.status, json?.status?.error_code)
      }

      cache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        data: json,
      })
      return json as T
    } catch (error) {
      lastError = error
      if (error instanceof CmcApiError && ![429, 500, 502, 503, 504].includes(error.status)) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt))
    }
  }

  if (lastError instanceof Error) throw lastError
  throw new CmcApiError("CoinMarketCap request failed after retries.", 500)
}
