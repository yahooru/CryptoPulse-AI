import { ASSET_CATALOG, type PortfolioInput } from "@/lib/portfolio"
import { fetchQuotesForSymbols } from "@/lib/cmc"
import { fetchWithTimeout } from "@/lib/fetch-timeout"

const BSC_RPC_URL = process.env.BSC_RPC_URL ?? "https://bsc-dataseed.binance.org"
const BALANCE_OF_SELECTOR = "0x70a08231"
export const BSC_SUPPORTED_ASSET_SYMBOLS = ASSET_CATALOG.filter((asset) => asset.bsc).map((asset) => asset.symbol)

type JsonRpcResponse<T> = {
  result?: T
  error?: {
    code: number
    message: string
  }
}

export type OnchainHolding = PortfolioInput & {
  name: string
  balance: number
  price: number
}

export function isAddress(address: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export async function readBnbChainPortfolio(walletAddress: string): Promise<OnchainHolding[]> {
  if (!isAddress(walletAddress)) {
    throw new Error("Invalid BNB Chain wallet address.")
  }

  const bscAssets = ASSET_CATALOG.filter((asset) => asset.bsc)
  const balanceResults = await Promise.allSettled(
    bscAssets.map<Promise<{ asset: (typeof bscAssets)[number]; balance: number } | null>>(async (asset) => {
      if (!asset.bsc) return null
      const raw = asset.bsc.native
        ? await rpc<string>("eth_getBalance", [walletAddress, "latest"])
        : await rpc<string>("eth_call", [
            {
              to: asset.bsc.address,
              data: `${BALANCE_OF_SELECTOR}${walletAddress.slice(2).padStart(64, "0")}`,
            },
            "latest",
          ])

      return {
        asset,
        balance: formatUnits(parseHexQuantity(raw), asset.bsc.decimals),
      }
    }),
  )
  const balances = balanceResults
    .map((result) => (result.status === "fulfilled" ? result.value : null))
    .filter((item): item is { asset: (typeof bscAssets)[number]; balance: number } => item !== null)

  const nonZeroBalances = balances.filter((item) => item.balance > 0)

  if (!nonZeroBalances.length) return []

  const quotes = await fetchQuotesForSymbols(nonZeroBalances.map((item) => item.asset.symbol))
  const priceBySymbol = new Map(quotes.map((quote) => [quote.symbol.toUpperCase(), quote.quote.USD.price]))

  const nonZero = nonZeroBalances
    .map<OnchainHolding>((item) => {
      const price = priceBySymbol.get(item.asset.symbol) ?? 0
      const usdValue = item.balance * price
      return {
        symbol: item.asset.symbol,
        name: item.asset.name,
        balance: item.balance,
        amount: item.balance,
        price,
        usdValue,
      }
    })
    .filter((holding) => (holding.usdValue ?? 0) > 0.01)
    .sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0))

  const totalUsd = nonZero.reduce((sum, holding) => sum + (holding.usdValue ?? 0), 0)
  return nonZero.map((holding) => ({
    ...holding,
    weight: totalUsd > 0 ? ((holding.usdValue ?? 0) / totalUsd) * 100 : 0,
  }))
}

async function rpc<T>(method: string, params: unknown[]) {
  const response = await fetchWithTimeout(BSC_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
    cache: "no-store",
  }, 10_000, "BNB Chain RPC")

  if (!response.ok) {
    throw new Error(`BNB Chain RPC failed with HTTP ${response.status}.`)
  }

  const json = (await response.json()) as JsonRpcResponse<T>
  if (json.error) {
    throw new Error(json.error.message)
  }
  return json.result as T
}

function formatUnits(value: bigint, decimals: number) {
  if (value === BigInt(0)) return 0
  const divisor = 10n ** BigInt(decimals)
  const integer = value / divisor
  const fraction = value % divisor
  const fractionText = fraction.toString().padStart(decimals, "0").slice(0, 8).replace(/0+$/, "")
  return Number(`${integer.toString()}${fractionText ? `.${fractionText}` : ""}`)
}

function parseHexQuantity(value?: string) {
  if (!value) return 0n
  if (!/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new Error("BNB Chain RPC returned an invalid balance.")
  }
  return BigInt(value)
}
