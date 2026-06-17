"use client"

import Link from "next/link"
import type { ComponentType, SVGProps } from "react"
import { ArrowRight, BarChart3, Brain, LineChart, Menu, ShieldCheck, Wallet, X } from "lucide-react"
import { useState } from "react"

import { AnimatedMarketBackground } from "@/components/animated-market-background"
import { Brand } from "@/components/brand"
import { LineShadowText } from "@/components/line-shadow-text"

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/analysis", label: "Analysis" },
  { href: "/risk", label: "Risk" },
  { href: "/backtesting", label: "Backtesting" },
]

const proofPoints = [
  "Live CMC market data with Binance-backed replay fallback",
  "BNB Chain wallet intake with optional custom token checks",
  "Clear risk, rebalance, and simulation notes before any action",
]

const workflow = [
  {
    title: "Start with your actual allocation",
    body: "Paste simple weights or read a BNB Chain wallet snapshot. CryptoPulse normalizes the portfolio before scoring concentration, role exposure, and drawdown pressure.",
  },
  {
    title: "Separate signal from noise",
    body: "The analysis blends CMC quotes, sentiment, market-cap context, and replay coverage so the report explains what changed instead of throwing out generic crypto advice.",
  },
  {
    title: "Review the rebalance plan",
    body: "Targets are shown as weights, deltas, risk guards, and simulation-only tickets. Nothing is signed or executed from the app.",
  },
  {
    title: "Export when you need depth",
    body: "Download the JSON spec for deeper research, external backtesting, or sharing a reproducible allocation thesis with your team.",
  },
]

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="cp-home min-h-screen">
      <AnimatedMarketBackground />

      <header className="cp-home-header">
        <Brand />

        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary navigation">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="cp-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <Link href="/dashboard" className="cp-header-action">
            Open Dashboard
          </Link>
        </div>

        <button
          className="cp-icon-button cp-home-menu-button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </header>

      {mobileMenuOpen && (
        <div id="mobile-menu" className="cp-mobile-menu">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="cp-nav-link" onClick={() => setMobileMenuOpen(false)}>
              {item.label}
            </Link>
          ))}
          <Link href="/dashboard" className="cp-header-action w-fit" onClick={() => setMobileMenuOpen(false)}>
            Open Dashboard
          </Link>
        </div>
      )}

      <main className="relative z-10">
        <section className="cp-hero">
          <div className="cp-hero-copy">
            <h1>
              Crypto Portfolio
              <br />
              {" "}
              <LineShadowText className="italic font-light" shadowColor="white">
                Doctor
              </LineShadowText>
            </h1>
            <p>
              Diagnose your crypto allocation with live market data, BNB Chain wallet intake, dynamic replay, and a clear rebalance plan you can review before taking action.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/dashboard" className="cp-primary-link cp-primary-action">
                Start Diagnosis
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/backtesting" className="cp-secondary-action">
                View Replay Lab
              </Link>
            </div>
            <div className="cp-proof-list">
              {proofPoints.map((point) => (
                <p key={point}>
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  {point}
                </p>
              ))}
            </div>
          </div>

          <div className="cp-hero-instrument" aria-label="CryptoPulse AI strategy flow preview">
            <div className="cp-instrument-topline">
              <span>Portfolio Engine</span>
              <strong>Live after diagnosis</strong>
            </div>
            <div className="cp-live-state">
              <SparkLineLabel label="Portfolio source" value="Manual input or BNB Chain wallet" />
              <SparkLineLabel label="Market source" value="CoinMarketCap server route" />
              <SparkLineLabel label="Report state" value="Generated only after user analysis" />
            </div>
            <div className="cp-instrument-flow">
              <FlowStep icon={Wallet} label="BNB Chain intake" value="wallet or manual" />
              <FlowStep icon={BarChart3} label="CMC market data" value="quotes + sentiment" />
              <FlowStep icon={Brain} label="AI reasoning" value="risk + optimizer" />
              <FlowStep icon={LineChart} label="Replay lab" value="JSON export" />
            </div>
          </div>
        </section>

        <section className="cp-home-band">
          <div>
            <p className="cp-kicker">Portfolio clarity</p>
            <h2>Know what you hold, what is risky, and what a cleaner allocation could look like.</h2>
          </div>
          <div className="cp-home-columns">
            <Feature title="Data discipline" body="Symbols resolve into CMC ids, then server routes fetch quotes, market cap, volume, return windows, and sentiment with API-key isolation." />
            <Feature title="On-chain intake" body="Trust Wallet or another EVM wallet can switch to BNB Smart Chain and read native BNB, catalog assets, and user-supplied BEP-20 contracts through RPC." />
            <Feature title="Replay ready" body="The app shows provider coverage, benchmark comparison, dynamic weekly replay rules, costs, slippage, and simulation-only trade tickets." />
          </div>
        </section>

        <section className="cp-home-band">
          <div>
            <p className="cp-kicker">How it helps</p>
            <h2>Move from scattered holdings to a portfolio report you can actually reason about.</h2>
          </div>
          <div className="cp-home-columns">
            {workflow.map((item) => (
              <Feature key={item.title} title={item.title} body={item.body} />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

function SparkLineLabel({ label, value }: { label: string; value: string }) {
  return (
    <div className="cp-live-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function FlowStep({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  value: string
}) {
  return (
    <div className="cp-flow-step">
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <article className="cp-feature-line">
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  )
}
