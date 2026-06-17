"use client"

import { useEffect, useState } from "react"
import type { ComponentType, CSSProperties, SVGProps } from "react"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Coins,
  Download,
  Loader2,
  PlugZap,
  RefreshCcw,
  Shield,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react"

import { ShimmerButton } from "@/components/shimmer-button"
import { DEFAULT_PORTFOLIO_TEXT, type PortfolioAnalysis, type PortfolioInput } from "@/lib/portfolio"
import { clearStoredAnalysis, readStoredAnalysis, writeStoredAnalysis } from "@/lib/report-storage"
import { cn } from "@/lib/utils"

declare global {
  interface Window {
    ethereum?: {
      request: (params: { method: string; params?: unknown[] }) => Promise<unknown>
    }
  }
}

type AnalyzeResponse = {
  analysis?: PortfolioAnalysis
  error?: string
}

type OnchainResponse = {
  walletAddress?: string
  holdings?: Array<PortfolioInput & { balance: number; price: number; name: string; source?: "catalog" | "custom" }>
  coverage?: {
    catalogAssetsScanned: number
    customTokensScanned: number
    pricedAssets: number
    unpricedCustomTokens: Array<{ address: string; symbol: string }>
  }
  supportedSymbols?: string[]
  error?: string
}

const PORTFOLIO_PLACEHOLDER = "Paste one asset per line using SYMBOL WEIGHT%.\nThe report is generated only from your input or your connected BNB Chain wallet."
const CUSTOM_TOKEN_PLACEHOLDER = "Optional custom BEP-20 contracts, one per line.\n0xTokenContract SYMBOL DECIMALS"

export function PortfolioLab() {
  const [portfolioText, setPortfolioText] = useState(DEFAULT_PORTFOLIO_TEXT)
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [walletLoading, setWalletLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [onchainPositions, setOnchainPositions] = useState<PortfolioInput[] | null>(null)
  const [customTokensText, setCustomTokensText] = useState("")
  const [walletCoverage, setWalletCoverage] = useState<OnchainResponse["coverage"] | null>(null)

  useEffect(() => {
    try {
      setAnalysis(readStoredAnalysis(window.localStorage))
    } catch {
      try {
        clearStoredAnalysis(window.localStorage)
      } catch {
        // Storage can be unavailable in hardened browsers.
      }
    }
  }, [])

  async function runAnalysis(source: "manual" | "bnb-chain" = "manual") {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/portfolio/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioText: source === "manual" ? portfolioText : undefined,
          positions: source === "bnb-chain" ? onchainPositions : undefined,
          source,
        }),
      })
      const json = (await response.json()) as AnalyzeResponse
      if (!response.ok || !json.analysis) {
        throw new Error(json.error ?? "Portfolio analysis failed.")
      }
      setAnalysis(json.analysis)
      try {
        writeStoredAnalysis(window.localStorage, json.analysis)
      } catch {
        // Keep the generated report visible even when persistence is blocked.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portfolio analysis failed.")
    } finally {
      setLoading(false)
    }
  }

  async function connectWallet() {
    setWalletLoading(true)
    setError(null)
    try {
      if (!window.ethereum) {
        throw new Error("No injected wallet was detected. Install Trust Wallet or another EVM wallet, then retry.")
      }

      await ensureBnbChain()
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[]
      const address = accounts[0]
      if (!address) throw new Error("Wallet connection was cancelled.")

      const response = await fetch("/api/onchain/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, customTokens: parseCustomTokens(customTokensText) }),
      })
      const json = (await response.json()) as OnchainResponse
      if (!response.ok || !json.holdings) {
        throw new Error(json.error ?? "Unable to read BNB Chain holdings.")
      }
      if (!json.holdings.length) {
        const supported = json.supportedSymbols?.length ? ` Supported assets: ${json.supportedSymbols.join(", ")}.` : ""
        throw new Error(`No supported BNB Chain balances were found for this wallet.${supported}`)
      }

      setWalletAddress(address)
      setOnchainPositions(json.holdings)
      setWalletCoverage(json.coverage ?? null)
      setPortfolioText(json.holdings.map((holding) => `${holding.symbol} ${formatPercent(holding.weight ?? 0)}`).join("\n"))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed.")
    } finally {
      setWalletLoading(false)
    }
  }

  const hasOnchainPortfolio = Boolean(onchainPositions?.length)

  function clearReport() {
    setAnalysis(null)
    setError(null)
    setWalletAddress(null)
    setOnchainPositions(null)
    setWalletCoverage(null)
    setPortfolioText(DEFAULT_PORTFOLIO_TEXT)
    try {
      clearStoredAnalysis(window.localStorage)
    } catch {
      // Storage can be unavailable in hardened browsers.
    }
  }

  return (
    <div className="space-y-8">
      <section className="cp-workbench">
        <div className="space-y-5">
          <div>
            <p className="cp-kicker">Strategy intake</p>
            <h1 className="cp-page-title">Portfolio Doctor</h1>
            <p className="cp-muted max-w-2xl">
              Enter allocation weights or connect a BNB Chain wallet. CryptoPulse pulls CMC data server-side, scores the portfolio, and exports a Track 2 strategy spec.
            </p>
          </div>

          <div className="cp-input-rail">
            <label htmlFor="portfolio" className="text-sm font-medium text-white">
              Portfolio allocation
            </label>
            <textarea
              id="portfolio"
              value={portfolioText}
              onChange={(event) => {
                setPortfolioText(event.target.value)
                setOnchainPositions(null)
                setWalletAddress(null)
                setWalletCoverage(null)
              }}
              className="cp-textarea"
              placeholder={PORTFOLIO_PLACEHOLDER}
              spellCheck={false}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "portfolio-error" : undefined}
            />
            <label htmlFor="custom-tokens" className="text-sm font-medium text-white">
              Custom BNB Chain tokens
            </label>
            <textarea
              id="custom-tokens"
              value={customTokensText}
              onChange={(event) => setCustomTokensText(event.target.value)}
              className="cp-textarea cp-textarea-compact"
              placeholder={CUSTOM_TOKEN_PLACEHOLDER}
              spellCheck={false}
            />
            <div className="flex flex-wrap items-center gap-3">
              <ShimmerButton
                onClick={() => runAnalysis(hasOnchainPortfolio ? "bnb-chain" : "manual")}
                disabled={loading || walletLoading}
                className="cp-primary-action"
                shimmerDuration="3s"
                aria-busy={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Activity className="h-4 w-4" aria-hidden="true" />}
                Analyze Portfolio
              </ShimmerButton>
              <button className="cp-secondary-action" onClick={connectWallet} disabled={walletLoading || loading} aria-busy={walletLoading}>
                {walletLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Wallet className="h-4 w-4" aria-hidden="true" />}
                Read BNB Chain Wallet
              </button>
              <button className="cp-secondary-action" onClick={clearReport} disabled={loading || walletLoading || (!analysis && !portfolioText)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Clear Report
              </button>
            </div>
            {walletAddress && (
              <p className="cp-success-line" role="status">
                <PlugZap className="h-4 w-4" aria-hidden="true" />
                BNB Chain snapshot loaded from {shortAddress(walletAddress)}
              </p>
            )}
            {walletCoverage && (
              <div className="cp-wallet-coverage">
                <Coins className="h-4 w-4 text-orange-200" aria-hidden="true" />
                <div>
                  <p>
                    Wallet coverage: {walletCoverage.pricedAssets} priced asset
                    {walletCoverage.pricedAssets === 1 ? "" : "s"} from {walletCoverage.catalogAssetsScanned} catalog checks
                    {walletCoverage.customTokensScanned ? ` and ${walletCoverage.customTokensScanned} custom token checks` : ""}.
                  </p>
                  {walletCoverage.unpricedCustomTokens.length > 0 && (
                    <p className="mt-1 text-white/45">
                      Unpriced custom tokens: {walletCoverage.unpricedCustomTokens.map((token) => token.symbol).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            )}
            {error && (
              <p id="portfolio-error" className="cp-error-line" role="alert">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="cp-score-board">
          {analysis ? (
            <>
              <ScoreRing label="Health" value={analysis.healthScore} />
              <ScoreRing label="Risk" value={analysis.riskScore} invert />
              <ScoreRing label="Diversification" value={analysis.diversificationScore} />
              <div className="cp-regime">
                <p className="text-xs uppercase text-white/45">Market regime</p>
                <p className="mt-2 text-xl font-semibold text-white">{analysis.marketRegime}</p>
                <p className="mt-3 text-sm text-white/60">
                  {analysis.fearGreed ? `CMC Fear and Greed: ${analysis.fearGreed.value} (${analysis.fearGreed.classification})` : "CMC sentiment endpoint unavailable for this run."}
                </p>
                <p className="mt-2 text-xs text-white/40">
                  Source: {analysis.source === "bnb-chain" ? "BNB Chain wallet + CMC" : "manual allocation + CMC"} / Generated {formatTimestamp(analysis.generatedAt)}
                </p>
              </div>
            </>
          ) : (
            <div className="cp-empty-state">
              <Shield className="h-10 w-10 text-orange-200" aria-hidden="true" />
              <p className="text-xl font-semibold text-white">Ready for first diagnosis</p>
              <p className="cp-muted">The report appears here after CMC returns live market data.</p>
            </div>
          )}
        </div>
      </section>

      {analysis && <AnalysisResults analysis={analysis} />}
    </div>
  )
}

function AnalysisResults({ analysis }: { analysis: PortfolioAnalysis }) {
  const topRecommendations = analysis.recommendations.slice(0, 5)
  const narrative = analysis.ai

  return (
    <>
      <section className="cp-section-grid">
        <div className="cp-panel">
          <div className="cp-panel-heading">
            <p className="cp-kicker">Allocation</p>
            <h2>Current exposure</h2>
          </div>
          <div className="space-y-4">
            {analysis.positions.map((position) => (
              <AllocationRow
                key={position.symbol}
                label={`${position.symbol} - ${position.name}`}
                value={position.weight}
                meta={`${position.role} / ${formatPercent(position.change7d)} 7d`}
              />
            ))}
          </div>
        </div>

        <div className="cp-panel">
          <div className="cp-panel-heading">
            <p className="cp-kicker">Rebalance</p>
            <h2>Recommended target</h2>
          </div>
          <div className="space-y-4">
            {topRecommendations.map((item) => (
              <div key={item.symbol} className="cp-reco-row">
                <div>
                  <p className="font-semibold text-white">{item.symbol}</p>
                  <p className="text-sm text-white/55">{item.rationale}</p>
                </div>
                <div className={cn("cp-reco-delta", item.delta > 0 ? "is-positive" : item.delta < 0 ? "is-negative" : "")}>
                  {item.delta > 0 ? "+" : ""}
                  {formatPercent(item.delta)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cp-section-grid">
        <div className="cp-panel">
          <div className="cp-panel-heading">
            <p className="cp-kicker">Backtestable output</p>
            <h2>Current vs optimized</h2>
          </div>
          <div className="cp-backtest-pair">
            <Metric label={analysis.backtest.method === "historical-replay" ? "Current return" : "Current return proxy"} value={formatPercent(analysis.backtest.currentReturn)} />
            <Metric label={analysis.backtest.method === "historical-replay" ? "Optimized return" : "Optimized return proxy"} value={formatPercent(analysis.backtest.optimizedReturn)} highlight />
            {analysis.backtest.benchmarkReturn !== undefined && (
              <Metric label="Benchmark return" value={formatPercent(analysis.backtest.benchmarkReturn)} />
            )}
            <Metric label={analysis.backtest.method === "historical-replay" ? "Current drawdown" : "Current drawdown proxy"} value={formatPercent(analysis.backtest.currentDrawdownProxy)} />
            <Metric label={analysis.backtest.method === "historical-replay" ? "Optimized drawdown" : "Optimized drawdown proxy"} value={formatPercent(analysis.backtest.optimizedDrawdownProxy)} highlight />
          </div>
          <p className="mt-4 text-xs text-white/40">
            Method: {analysis.backtest.method === "historical-replay" ? `${formatProvider(analysis.backtest.dataProvider)} dynamic weekly replay` : "CMC quote-window proxy"}
            {analysis.backtest.dataCoverage ? ` / Coverage ${analysis.backtest.dataCoverage.coveragePct}%` : ""}
          </p>
          <button className="cp-secondary-action mt-5" onClick={() => downloadSpec(analysis)}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Download strategy spec
          </button>
        </div>

        <div className="cp-panel">
          <div className="cp-panel-heading">
            <p className="cp-kicker">AI reasoning</p>
            <h2>Investment committee note</h2>
          </div>
          <div className="space-y-4">
            <ReasonLine icon={Sparkles} label="Thesis" text={narrative?.thesis ?? analysis.agentSignals[0]?.finding ?? "CMC-backed strategy generated."} />
            <ReasonLine icon={CheckCircle2} label="Doctor note" text={narrative?.portfolioDoctorNote ?? analysis.agentSignals[1]?.finding ?? "Risk sleeve computed."} />
            <ReasonLine icon={RefreshCcw} label="Judge pitch" text={narrative?.judgePitch ?? "Track 2 output is a reproducible allocation spec backed by CMC data and BNB Chain reads."} />
          </div>
          <p className="mt-5 text-xs text-white/40">{analysis.aiStatus}</p>
        </div>
      </section>

      <section className="cp-disclosure" role="note">
        CryptoPulse AI stores the latest report only in this browser so the dashboard pages can reuse it. Clear Report removes that local copy. This is a backtestable strategy research tool, not financial advice or live trade execution.
      </section>
    </>
  )
}

function ScoreRing({ label, value, invert = false }: { label: string; value: number; invert?: boolean }) {
  const normalized = Math.max(0, Math.min(100, value))
  const color = invert ? 100 - normalized : normalized
  return (
    <div
      className="cp-score-ring"
      style={{ "--score": normalized, "--tone": color } as CSSProperties}
      role="img"
      aria-label={`${label} score ${normalized} out of 100`}
    >
      <div className="cp-ring-visual" aria-hidden="true">
        <span>{normalized}</span>
      </div>
      <p>{label}</p>
    </div>
  )
}

function AllocationRow({ label, value, meta }: { label: string; value: number; meta: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{label}</p>
          <p className="text-xs text-white/45">{meta}</p>
        </div>
        <span className="shrink-0 text-sm text-white/70">{formatPercent(value)}</span>
      </div>
      <div className="cp-progress">
        <span style={{ width: `${Math.min(100, Math.max(2, value))}%` }} />
      </div>
    </div>
  )
}

function Metric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("cp-metric", highlight && "is-highlight")}>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  )
}

function ReasonLine({
  icon: Icon,
  label,
  text,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  text: string
}) {
  return (
    <div className="cp-reason-line">
      <Icon className="h-4 w-4" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-sm text-white/58">{text}</p>
      </div>
    </div>
  )
}

async function ensureBnbChain() {
  if (!window.ethereum) return
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x38" }],
    })
  } catch (error) {
    if (!isMissingChainError(error)) {
      throw error
    }
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: "0x38",
          chainName: "BNB Smart Chain",
          nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
          rpcUrls: ["https://bsc-dataseed.binance.org"],
          blockExplorerUrls: ["https://bscscan.com"],
        },
      ],
    })
  }
}

function isMissingChainError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && Number((error as { code?: unknown }).code) === 4902
}

function downloadSpec(analysis: PortfolioAnalysis) {
  const payload = JSON.stringify(
    {
      ...analysis.strategySpec,
      scores: {
        health: analysis.healthScore,
        risk: analysis.riskScore,
        diversification: analysis.diversificationScore,
      },
      recommendations: analysis.recommendations,
    },
    null,
    2,
  )
  const blob = new Blob([payload], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = "cryptopulse-strategy-spec.json"
  anchor.click()
  URL.revokeObjectURL(url)
}

function formatPercent(value: number) {
  return `${Math.round(value * 10) / 10}%`
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function parseCustomTokens(text: string) {
  return text
    .split(/\r?\n|,/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const [address, symbol, decimals] = row.split(/\s+/)
      return {
        address,
        symbol,
        decimals: decimals ? Number(decimals) : undefined,
      }
    })
    .filter((token) => /^0x[a-fA-F0-9]{40}$/.test(token.address))
}

function formatProvider(provider: PortfolioAnalysis["backtest"]["dataProvider"]) {
  if (provider === "binance") return "Binance"
  if (provider === "coinmarketcap+binance") return "CMC + Binance"
  if (provider === "coinmarketcap") return "CMC"
  return "historical"
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
