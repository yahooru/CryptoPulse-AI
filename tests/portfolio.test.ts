import { describe, expect, it } from "vitest"

import {
  buildPortfolioAnalysis,
  normalizePortfolioInputs,
  parsePortfolioTextDetailed,
  type CmcQuote,
} from "../lib/portfolio"
import { applyHistoricalBacktest, type HistoricalPriceSeries } from "../lib/backtest"

function quote(symbol: string, id: number, change90d: number): CmcQuote {
  return {
    id,
    name: symbol,
    symbol,
    quote: {
      USD: {
        price: 100,
        market_cap: 1_000_000,
        volume_24h: 100_000,
        percent_change_24h: 1,
        percent_change_7d: 2,
        percent_change_30d: change90d / 2,
        percent_change_90d: change90d,
      },
    },
  }
}

describe("portfolio parsing", () => {
  it("reports malformed manual rows instead of silently dropping them", () => {
    const parsed = parsePortfolioTextDetailed("BTC 41%\nnot a number")

    expect(parsed.inputs).toEqual([{ symbol: "BTC", weight: 41 }])
    expect(parsed.invalidRows).toEqual(["not a number"])
  })

  it("aggregates duplicate symbols before normalizing weights", () => {
    const normalized = normalizePortfolioInputs([
      { symbol: "btc", weight: 25 },
      { symbol: "BTC", weight: 25 },
      { symbol: "ETH", weight: 50 },
    ])

    expect(normalized).toEqual([
      { symbol: "BTC", weight: 50, amount: undefined, usdValue: undefined },
      { symbol: "ETH", weight: 50, amount: undefined, usdValue: undefined },
    ])
  })
})

describe("portfolio analysis", () => {
  it("uses quote data for target assets that were not in the original portfolio", () => {
    const analysis = buildPortfolioAnalysis({
      inputs: [
        { symbol: "DOGE", weight: 50 },
        { symbol: "PEPE", weight: 50 },
      ],
      quotes: [
        quote("DOGE", 74, -25),
        quote("PEPE", 24478, -35),
        quote("BTC", 1, 18),
        quote("ETH", 1027, 22),
        quote("BNB", 1839, 12),
        quote("USDT", 825, 0),
        quote("LINK", 1975, 16),
      ],
      source: "manual",
    })

    expect(analysis.recommendations.some((item) => item.action === "add")).toBe(true)
    expect(analysis.backtest.optimizedReturn).toBeGreaterThan(0)
    expect(analysis.strategySpec.universe.map((asset) => asset.symbol)).toContain("BTC")
    expect(analysis.strategySpec.targetAllocation.reduce((sum, asset) => sum + asset.weight, 0)).toBeCloseTo(100, 1)
    expect(analysis.strategySpec.uniqueName).toBe("cryptopulse_portfolio_doctor")
  })

  it("upgrades proxy metrics to a historical replay when daily prices are available", () => {
    const analysis = buildPortfolioAnalysis({
      inputs: [
        { symbol: "DOGE", weight: 50 },
        { symbol: "PEPE", weight: 50 },
      ],
      quotes: [
        quote("DOGE", 74, -25),
        quote("PEPE", 24478, -35),
        quote("BTC", 1, 18),
        quote("ETH", 1027, 22),
        quote("BNB", 1839, 12),
        quote("USDT", 825, 0),
        quote("LINK", 1975, 16),
      ],
      source: "manual",
    })

    const replayed = applyHistoricalBacktest(analysis, [
      history("DOGE", 74, 1, 0.65),
      history("PEPE", 24478, 1, 0.58),
      history("BTC", 1, 1, 1.18),
      history("ETH", 1027, 1, 1.22),
      history("BNB", 1839, 1, 1.12),
      history("LINK", 1975, 1, 1.16),
      history("USDT", 825, 1, 1),
    ])

    expect(replayed.backtest.method).toBe("historical-replay")
    expect(replayed.backtest.observations).toBeGreaterThanOrEqual(20)
    expect(replayed.backtest.benchmarkReturn).toBeDefined()
    expect(replayed.backtest.dataProvider).toBe("coinmarketcap")
    expect(replayed.backtest.rebalanceEvents).toBeGreaterThan(1)
    expect(replayed.backtest.dynamicRules?.length).toBeGreaterThan(0)
    expect(replayed.backtest.dataCoverage?.coveragePct).toBeGreaterThan(50)
    expect(replayed.strategySpec.execution.intents.some((intent) => intent.side !== "hold")).toBe(true)
  })
})

function history(symbol: string, cmcId: number, start: number, end: number): HistoricalPriceSeries {
  const points = Array.from({ length: 35 }, (_, index) => {
    const ratio = index / 34
    const price = start + (end - start) * ratio
    return {
      timestamp: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
      price,
    }
  })
  return { symbol, cmcId, points }
}
