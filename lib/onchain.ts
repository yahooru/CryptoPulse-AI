import { ASSET_CATALOG, type AssetMeta, type PortfolioInput } from "@/lib/portfolio"
import { fetchQuotesForSymbols } from "@/lib/cmc"
import { fetchWithTimeout } from "@/lib/fetch-timeout"

const BSC_RPC_URL = process.env.BSC_RPC_URL ?? "https://bsc-dataseed.binance.org"
const BALANCE_OF_SELECTOR = "0x70a08231"
const DECIMALS_SELECTOR = "0x313ce567"
const SYMBOL_SELECTOR = "0x95d89b41"
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
  source: "catalog" | "custom"
}

export type CustomBep20Token = {
  address: `0x${string}`
  symbol?: string
  decimals?: number
}

export type OnchainReadCoverage = {
  catalogAssetsScanned: number
  customTokensScanned: number
  pricedAssets: number
  unpricedCustomTokens: Array<{ address: string; symbol: string }>
}

export type OnchainPortfolioRead = {
  holdings: OnchainHolding[]
  coverage: OnchainReadCoverage
}

export function isAddress(address: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export async function readBnbChainPortfolio(
  walletAddress: string,
  customTokens: CustomBep20Token[] = [],
): Promise<OnchainPortfolioRead> {
  if (!isAddress(walletAddress)) {
    throw new Error("Invalid BNB Chain wallet address.")
  }

  const bscAssets = ASSET_CATALOG.filter((asset): asset is ReadableBscAsset => Boolean(asset.bsc)).map((asset) => ({
    ...asset,
    source: "catalog" as const,
  }))
  const customAssets = await resolveCustomAssets(customTokens, bscAssets)
  const assets = [...bscAssets, ...customAssets]
  const balanceResults = await Promise.allSettled(
    assets.map<Promise<{ asset: ReadableBscAsset; balance: number } | null>>(async (asset) => {
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
    .filter((item): item is { asset: ReadableBscAsset; balance: number } => item !== null)

  const nonZeroBalances = balances.filter((item) => item.balance > 0)

  if (!nonZeroBalances.length) {
    return {
      holdings: [],
      coverage: {
        catalogAssetsScanned: bscAssets.length,
        customTokensScanned: customAssets.length,
        pricedAssets: 0,
        unpricedCustomTokens: [],
      },
    }
  }

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
        source: item.asset.source ?? "catalog",
      }
    })
    .filter((holding) => (holding.usdValue ?? 0) > 0.01)
    .sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0))

  const totalUsd = nonZero.reduce((sum, holding) => sum + (holding.usdValue ?? 0), 0)
  const holdings = nonZero.map((holding) => ({
    ...holding,
    weight: totalUsd > 0 ? ((holding.usdValue ?? 0) / totalUsd) * 100 : 0,
  }))
  const pricedSymbols = new Set(holdings.map((holding) => holding.symbol))
  const unpricedCustomTokens = nonZeroBalances
    .filter((item) => item.asset.source === "custom" && !pricedSymbols.has(item.asset.symbol))
    .map((item) => ({
      address: item.asset.bsc?.address ?? "",
      symbol: item.asset.symbol,
    }))

  return {
    holdings,
    coverage: {
      catalogAssetsScanned: bscAssets.length,
      customTokensScanned: customAssets.length,
      pricedAssets: holdings.length,
      unpricedCustomTokens,
    },
  }
}

type ReadableBscAsset = AssetMeta & {
  source?: "catalog" | "custom"
  bsc: NonNullable<AssetMeta["bsc"]>
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

async function resolveCustomAssets(customTokens: CustomBep20Token[], catalogAssets: AssetMeta[]) {
  const catalogAddresses = new Set(
    catalogAssets
      .map((asset) => asset.bsc?.address?.toLowerCase())
      .filter((address): address is string => Boolean(address)),
  )
  const uniqueTokens = Array.from(
    new Map(
      customTokens
        .filter((token) => isAddress(token.address) && !catalogAddresses.has(token.address.toLowerCase()))
        .map((token) => [token.address.toLowerCase(), token]),
    ).values(),
  )

  const results = await Promise.allSettled(
    uniqueTokens.map(async (token): Promise<ReadableBscAsset | null> => {
      const [symbol, decimals] = await Promise.all([
        token.symbol ? Promise.resolve(token.symbol.toUpperCase()) : readTokenSymbol(token.address),
        Number.isFinite(token.decimals) ? Promise.resolve(Number(token.decimals)) : readTokenDecimals(token.address),
      ])
      if (!symbol || !Number.isFinite(decimals)) return null
      return {
        symbol,
        name: symbol,
        cmcId: 0,
        sector: "Custom BEP-20",
        role: "large-cap",
        riskTier: 4,
        source: "custom",
        bsc: {
          address: token.address,
          decimals,
        },
      }
    }),
  )

  return results
    .map((result) => (result.status === "fulfilled" ? result.value : null))
    .filter((asset): asset is ReadableBscAsset => asset !== null)
}

async function readTokenDecimals(address: `0x${string}`) {
  const raw = await rpc<string>("eth_call", [{ to: address, data: DECIMALS_SELECTOR }, "latest"])
  const value = Number(parseHexQuantity(raw))
  return Number.isFinite(value) ? value : 18
}

async function readTokenSymbol(address: `0x${string}`) {
  const raw = await rpc<string>("eth_call", [{ to: address, data: SYMBOL_SELECTOR }, "latest"])
  return decodeTokenSymbol(raw)
}

function decodeTokenSymbol(raw?: string) {
  if (!raw || !raw.startsWith("0x")) return null
  const hex = raw.slice(2)
  if (!hex || /^0+$/.test(hex)) return null

  const dynamicOffset = Number.parseInt(hex.slice(0, 64), 16)
  if (dynamicOffset === 32 && hex.length >= 128) {
    const length = Number.parseInt(hex.slice(64, 128), 16)
    const data = hex.slice(128, 128 + length * 2)
    return decodeAsciiHex(data)
  }

  return decodeAsciiHex(hex.slice(0, 64))
}

function decodeAsciiHex(hex: string) {
  const bytes = hex.match(/.{1,2}/g) ?? []
  const text = bytes
    .map((byte) => Number.parseInt(byte, 16))
    .filter((value) => value > 0)
    .map((value) => String.fromCharCode(value))
    .join("")
    .trim()
  return /^[a-zA-Z0-9.-]{1,16}$/.test(text) ? text.toUpperCase() : null
}
