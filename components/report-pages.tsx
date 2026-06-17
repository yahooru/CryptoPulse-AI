"use client"

import { useEffect, useMemo, useState } from "react"
import type { ComponentType, SVGProps } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Download,
  LineChart,
  PieChart,
  ShieldAlert,
  Sparkles,
  Target,
} from "lucide-react"

import type { AgentSignal, ExecutionIntent, PortfolioAnalysis, Recommendation, StrategySpec } from "@/lib/portfolio"
import { clearStoredAnalysis, readStoredAnalysis } from "@/lib/report-storage"
import { cn } from "@/lib/utils"

type PageKind = "analysis" | "risk" | "recommendations" | "backtesting" | "reasoning"

export function ReportPage({ kind }: { kind: PageKind }) {
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null)
  const [storageChecked, setStorageChecked] = useState(false)

  useEffect(() => {
    try {
      setAnalysis(readStoredAnalysis(window.localStorage))
    } catch {
      try {
        clearStoredAnalysis(window.localStorage)
      } catch {
        // Storage can be unavailable in hardened browsers.
      }
    } finally {
      setStorageChecked(true)
    }
  }, [])

  if (!storageChecked) {
    return <LoadingReport kind={kind} />
  }

  if (!analysis) {
    return <EmptyReport kind={kind} />
  }

  if (kind === "analysis") return <AnalysisPage analysis={analysis} />
  if (kind === "risk") return <RiskPage analysis={analysis} />
  if (kind === "recommendations") return <RecommendationsPage analysis={analysis} />
  if (kind === "backtesting") return <BacktestingPage analysis={analysis} />
  return <ReasoningPage analysis={analysis} />
}

const pageTitles: Record<PageKind, string> = {
  analysis: "Portfolio Analysis",
  risk: "Risk Center",
  recommendations: "AI Recommendations",
  backtesting: "Backtesting Lab",
  reasoning: "AI Reasoning",
}

function LoadingReport({ kind }: { kind: PageKind }) {
  return (
    <section className="cp-page-hero" role="status" aria-live="polite">
      <div>
        <p className="cp-kicker">Loading report</p>
        <h1 className="cp-page-title">{pageTitles[kind]}</h1>
        <p className="cp-muted max-w-2xl">Syncing the latest Portfolio Doctor result from this browser.</p>
      </div>
      <div className="cp-page-icon">
        <Sparkles className="h-6 w-6 animate-pulse" aria-hidden="true" />
      </div>
    </section>
  )
}

function EmptyReport({ kind }: { kind: PageKind }) {
  const title = pageTitles[kind]

  return (
    <section className="cp-page-hero">
      <div>
        <p className="cp-kicker">Waiting for CMC data</p>
        <h1 className="cp-page-title">{title}</h1>
        <p className="cp-muted max-w-2xl">
          Run the Portfolio Doctor once from the dashboard. The report is stored locally and reused across each product page.
        </p>
      </div>
      <Link href="/dashboard" className="cp-primary-link">
        Open dashboard
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  )
}

function AnalysisPage({ analysis }: { analysis: PortfolioAnalysis }) {
  return (
    <div className="space-y-8">
      <PageHero
        kicker="Portfolio Analysis"
        title="Allocation Map"
        copy="Asset, role, and sector exposure built from live CMC quotes. Symbols resolve through stable CMC ids before scoring."
        icon={PieChart}
      />

      <section className="cp-section-grid">
        <ExposurePanel title="Sector allocation" data={analysis.sectorExposure} />
        <ExposurePanel title="Role allocation" data={analysis.roleExposure} />
      </section>

      <section className="cp-panel">
        <div className="cp-panel-heading">
          <p className="cp-kicker">Positions</p>
          <h2>CMC quote matrix</h2>
        </div>
        <div className="cp-table">
          <div className="cp-table-head">
            <span>Asset</span>
            <span>Weight</span>
            <span>Price</span>
            <span>7d</span>
            <span>Risk</span>
          </div>
          {analysis.positions.map((position) => (
            <div key={position.symbol} className="cp-table-row">
              <span>
                <strong>{position.symbol}</strong>
                <small>{position.name}</small>
              </span>
              <span>{formatPercent(position.weight)}</span>
              <span>{formatUsd(position.price)}</span>
              <span className={position.change7d >= 0 ? "text-emerald-300" : "text-rose-300"}>{formatPercent(position.change7d)}</span>
              <span>{position.riskTier}/5</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function RiskPage({ analysis }: { analysis: PortfolioAnalysis }) {
  const riskAlerts = useMemo(() => buildRiskAlerts(analysis), [analysis])

  return (
    <div className="space-y-8">
      <PageHero
        kicker="Risk Center"
        title="Drawdown Guardrails"
        copy="The risk model combines volatility proxy, concentration, role exposure, and CMC sentiment into practical portfolio guardrails."
        icon={ShieldAlert}
      />

      <section className="cp-score-strip">
        <ScoreBlock label="Risk score" value={`${analysis.riskScore}/100`} />
        <ScoreBlock label="Diversification" value={`${analysis.diversificationScore}/100`} />
        <ScoreBlock label="Regime" value={analysis.marketRegime} />
      </section>

      <section className="cp-section-grid">
        <div className="cp-panel">
          <div className="cp-panel-heading">
            <p className="cp-kicker">Alerts</p>
            <h2>What needs attention</h2>
          </div>
          <div className="space-y-4">
            {riskAlerts.map((alert) => (
              <div key={alert.title} className="cp-alert-row">
                <AlertTriangle className={cn("h-4 w-4", alert.severity === "high" ? "text-rose-300" : "text-orange-300")} aria-hidden="true" />
                <div>
                  <p className="font-medium text-white">{alert.title}</p>
                  <p className="text-sm text-white/56">{alert.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <AgentPanel signals={analysis.agentSignals} />
      </section>
    </div>
  )
}

function RecommendationsPage({ analysis }: { analysis: PortfolioAnalysis }) {
  return (
    <div className="space-y-8">
      <PageHero
        kicker="AI Recommendations"
        title="Rebalance Prescription"
        copy="Recommendations are expressed as target weights and deltas so the output can move directly into a backtest runner."
        icon={Sparkles}
      />

      <section className="cp-panel">
        <div className="cp-panel-heading">
          <p className="cp-kicker">Target allocation</p>
          <h2>Action list</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {analysis.recommendations.map((recommendation) => (
            <RecommendationTile key={recommendation.symbol} recommendation={recommendation} />
          ))}
        </div>
      </section>
    </div>
  )
}

function BacktestingPage({ analysis }: { analysis: PortfolioAnalysis }) {
  return (
    <div className="space-y-8">
      <PageHero
        kicker="Backtesting Lab"
        title="Strategy Spec Export"
        copy="Export the universe, filters, risk guards, costs, and replay assumptions behind the allocation plan."
        icon={LineChart}
      />

      <section className="cp-section-grid">
        <div className="cp-panel">
          <div className="cp-panel-heading">
            <p className="cp-kicker">Comparison</p>
            <h2>{analysis.backtest.method === "historical-replay" ? "Historical replay" : "Portfolio replay proxy"}</h2>
          </div>
          <div className="cp-backtest-pair">
            <ScoreBlock label="Current return" value={formatPercent(analysis.backtest.currentReturn)} />
            <ScoreBlock label="Optimized return" value={formatPercent(analysis.backtest.optimizedReturn)} tone="good" />
            {analysis.backtest.benchmarkReturn !== undefined && (
              <ScoreBlock label="Benchmark return" value={formatPercent(analysis.backtest.benchmarkReturn)} />
            )}
            <ScoreBlock label="Current drawdown" value={formatPercent(analysis.backtest.currentDrawdownProxy)} />
            <ScoreBlock label="Optimized drawdown" value={formatPercent(analysis.backtest.optimizedDrawdownProxy)} tone="good" />
            {analysis.backtest.optimizedSharpe !== undefined && (
              <ScoreBlock label="Optimized Sharpe" value={String(analysis.backtest.optimizedSharpe)} tone="good" />
            )}
            {analysis.backtest.rebalanceEvents !== undefined && (
              <ScoreBlock label="Rebalances" value={String(analysis.backtest.rebalanceEvents)} />
            )}
          </div>
          <p className="mt-4 text-xs text-white/40">
            {analysis.backtest.lookbackLabel}
            {analysis.backtest.startDate && analysis.backtest.endDate
              ? ` / ${analysis.backtest.startDate} to ${analysis.backtest.endDate}`
              : ""}
          </p>
          {analysis.backtest.dataCoverage && (
            <div className="cp-coverage-strip">
              <ScoreBlock label="Provider" value={formatProvider(analysis.backtest.dataProvider)} tone="good" />
              <ScoreBlock label="Coverage" value={`${analysis.backtest.dataCoverage.coveragePct}%`} tone="good" />
              <ScoreBlock label="Missing" value={analysis.backtest.dataCoverage.missingAssets.length ? analysis.backtest.dataCoverage.missingAssets.join(", ") : "None"} />
            </div>
          )}
          <button className="cp-secondary-action mt-5" onClick={() => downloadSpec(analysis)}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Download JSON spec
          </button>
        </div>

        <SpecPanel spec={analysis.strategySpec} />
      </section>
      <section className="cp-section-grid">
        <DynamicRulesPanel analysis={analysis} />
        <ExecutionPlanPanel intents={analysis.strategySpec.execution.intents} />
      </section>
    </div>
  )
}

function ReasoningPage({ analysis }: { analysis: PortfolioAnalysis }) {
  return (
    <div className="space-y-8">
      <PageHero
        kicker="AI Reasoning"
        title="Committee Trace"
        copy="Each agent has a narrow job: allocation, risk, market regime, optimizer, and backtest readiness. OpenAI adds narrative when configured."
        icon={Brain}
      />

      <section className="cp-section-grid">
        <div className="cp-panel">
          <div className="cp-panel-heading">
            <p className="cp-kicker">Narrative</p>
            <h2>Portfolio Doctor note</h2>
          </div>
          <div className="space-y-4">
            <NarrativeLine label="Thesis" text={analysis.ai?.thesis ?? analysis.agentSignals[0]?.finding} />
            <NarrativeLine label="Doctor note" text={analysis.ai?.portfolioDoctorNote ?? analysis.agentSignals[1]?.finding} />
            <NarrativeLine label="Strategy summary" text={analysis.ai?.strategySummary ?? analysis.strategySpec.trackFit} />
            <NarrativeLine label="Disclosure" text={analysis.ai?.riskDisclosure ?? "This is a backtestable strategy report, not financial advice or live execution."} />
          </div>
          <p className="mt-5 text-xs text-white/40">{analysis.aiStatus}</p>
        </div>
        <AgentPanel signals={analysis.agentSignals} />
      </section>
    </div>
  )
}

function PageHero({
  kicker,
  title,
  copy,
  icon: Icon,
}: {
  kicker: string
  title: string
  copy: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}) {
  return (
    <section className="cp-page-hero">
      <div>
        <p className="cp-kicker">{kicker}</p>
        <h1 className="cp-page-title">{title}</h1>
        <p className="cp-muted max-w-2xl">{copy}</p>
      </div>
      <div className="cp-page-icon">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
    </section>
  )
}

function ExposurePanel({ title, data }: { title: string; data: Array<{ label: string; weight: number }> }) {
  return (
    <div className="cp-panel">
      <div className="cp-panel-heading">
        <p className="cp-kicker">Exposure</p>
        <h2>{title}</h2>
      </div>
      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-white">{item.label}</span>
              <span className="text-sm text-white/65">{formatPercent(item.weight)}</span>
            </div>
            <div className="cp-progress">
              <span style={{ width: `${Math.min(100, Math.max(2, item.weight))}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AgentPanel({ signals }: { signals: AgentSignal[] }) {
  return (
    <div className="cp-panel">
      <div className="cp-panel-heading">
        <p className="cp-kicker">Agents</p>
        <h2>Decision trace</h2>
      </div>
      <div className="space-y-4">
        {signals.map((signal) => (
          <div key={signal.agent} className="cp-agent-row">
            <span className={cn("cp-agent-dot", `is-${signal.status}`)} />
            <div>
              <p className="font-medium text-white">{signal.agent}</p>
              <p className="text-sm text-white/58">{signal.finding}</p>
              <p className="mt-1 text-xs text-white/36">{signal.evidence}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecommendationTile({ recommendation }: { recommendation: Recommendation }) {
  return (
    <div className="cp-recommendation-tile">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-white">{recommendation.symbol}</p>
          <p className="text-sm capitalize text-white/48">{recommendation.action}</p>
        </div>
        <span className={cn("cp-reco-delta", recommendation.delta > 0 ? "is-positive" : recommendation.delta < 0 ? "is-negative" : "")}>
          {recommendation.delta > 0 ? "+" : ""}
          {formatPercent(recommendation.delta)}
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <ScoreBlock label="Current" value={formatPercent(recommendation.currentWeight)} />
        <ScoreBlock label="Target" value={formatPercent(recommendation.targetWeight)} tone="good" />
      </div>
      <p className="mt-4 text-sm text-white/58">{recommendation.rationale}</p>
    </div>
  )
}

function SpecPanel({ spec }: { spec: StrategySpec }) {
  return (
    <div className="cp-panel">
      <div className="cp-panel-heading">
        <p className="cp-kicker">Spec</p>
        <h2>Backtest ingredients</h2>
      </div>
      <SpecList title="Target allocation" items={spec.targetAllocation.map((item) => `${item.symbol}: ${formatPercent(item.weight)}`)} />
      <SpecList title="Entry filters" items={spec.entryFilters} />
      <SpecList title="Risk guards" items={spec.riskGuards} />
      <SpecList title="CMC Skill tools" items={[...spec.cmcSkill.requiredMcpTools, ...spec.cmcSkill.optionalMcpTools.slice(0, 3)]} />
      <SpecList title="Replay assumptions" items={[`Benchmark: ${spec.backtestConfig.benchmark}`, `Rebalance: ${spec.backtestConfig.rebalance}`, `Costs: ${spec.backtestConfig.transactionCostBps} bps + ${spec.backtestConfig.slippageBps} bps slippage`]} />
    </div>
  )
}

function DynamicRulesPanel({ analysis }: { analysis: PortfolioAnalysis }) {
  return (
    <div className="cp-panel">
      <div className="cp-panel-heading">
        <p className="cp-kicker">Replay engine</p>
        <h2>Dynamic strategy rules</h2>
      </div>
      <SpecList
        title="Rule set"
        items={analysis.backtest.dynamicRules?.length ? analysis.backtest.dynamicRules : analysis.strategySpec.rebalanceRules}
      />
      <SpecList title="Run notes" items={analysis.backtest.notes.slice(0, 4)} />
    </div>
  )
}

function ExecutionPlanPanel({ intents }: { intents: ExecutionIntent[] }) {
  return (
    <div className="cp-panel">
      <div className="cp-panel-heading">
        <p className="cp-kicker">Execution simulation</p>
        <h2>Reviewable trade tickets</h2>
      </div>
      <div className="space-y-3">
        {intents.slice(0, 6).map((intent) => (
          <div key={intent.symbol} className="cp-ticket-row">
            <div>
              <p className="font-semibold text-white">{intent.symbol}</p>
              <p className="text-xs text-white/45">
                {formatPercent(intent.fromWeight)} to {formatPercent(intent.toWeight)}
              </p>
            </div>
            <span className={cn("cp-reco-delta", intent.side === "buy" ? "is-positive" : intent.side === "sell" ? "is-negative" : "")}>
              {intent.side.toUpperCase()} {intent.deltaWeight > 0 ? "+" : ""}
              {formatPercent(intent.deltaWeight)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-white/40">
        Simulation only. CryptoPulse does not request approvals, sign swaps, or move funds.
      </p>
    </div>
  )
}

function SpecList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-5">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <Target className="h-4 w-4 text-orange-200" aria-hidden="true" />
        {title}
      </p>
      <div className="space-y-2">
        {items.map((item) => (
          <p key={item} className="text-sm text-white/58">
            {item}
          </p>
        ))}
      </div>
    </div>
  )
}

function ScoreBlock({ label, value, tone }: { label: string; value: string; tone?: "good" }) {
  return (
    <div className={cn("cp-score-block", tone === "good" && "is-good")}>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  )
}

function NarrativeLine({ label, text }: { label: string; text?: string }) {
  return (
    <div className="cp-narrative-line">
      <CheckCircle2 className="h-4 w-4 text-orange-200" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-sm text-white/58">{text}</p>
      </div>
    </div>
  )
}

function buildRiskAlerts(analysis: PortfolioAnalysis) {
  const alerts = []
  const top = [...analysis.positions].sort((a, b) => b.weight - a.weight)[0]
  const meme = analysis.roleExposure.find((item) => item.label === "meme")?.weight ?? 0
  const highRisk = analysis.positions.filter((position) => position.riskTier >= 4).reduce((sum, item) => sum + item.weight, 0)

  if (top && top.weight > 35) {
    alerts.push({
      severity: "high",
      title: "Concentration guard triggered",
      body: `${top.symbol} is ${formatPercent(top.weight)} of the portfolio. The strategy caps any single sleeve at 45%.`,
    })
  }
  if (meme > 8) {
    alerts.push({
      severity: "high",
      title: "Meme sleeve above target",
      body: `Meme exposure is ${formatPercent(meme)}. CryptoPulse reduces this sleeve before producing the backtest spec.`,
    })
  }
  if (highRisk > 25) {
    alerts.push({
      severity: "medium",
      title: "High-risk sleeve needs a budget",
      body: `Risk tier 4-5 assets make up ${formatPercent(highRisk)} of the portfolio.`,
    })
  }
  if (!alerts.length) {
    alerts.push({
      severity: "medium",
      title: "No hard risk guard tripped",
      body: "The strategy still keeps drift, drawdown, and stable-buffer checks in the exported spec.",
    })
  }
  return alerts
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

function formatUsd(value: number) {
  if (value >= 1) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value)
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumSignificantDigits: 4 }).format(value)
}

function formatProvider(provider: PortfolioAnalysis["backtest"]["dataProvider"]) {
  if (provider === "binance") return "Binance"
  if (provider === "coinmarketcap+binance") return "CMC + Binance"
  if (provider === "coinmarketcap") return "CMC"
  return "Proxy"
}
