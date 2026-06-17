import { NextResponse } from "next/server"

import {
  analyzeBodySchema,
  readJsonBody,
  validationErrorMessage,
} from "@/lib/api-validation"
import { applyHistoricalBacktest } from "@/lib/backtest"
import { fetchBinanceDailyKlinesForSymbols } from "@/lib/binance"
import { fetchCmcQuotes, fetchFearGreedLatest, fetchHistoricalQuotesForIds, resolveCmcIds, CmcApiError } from "@/lib/cmc"
import { generateAiNarrative, hasOpenAiKey } from "@/lib/openai-report"
import {
  buildPortfolioAnalysis,
  normalizePortfolioInputs,
  parsePortfolioTextDetailed,
  recommendedQuoteSymbolsForInputs,
  type PortfolioInput,
} from "@/lib/portfolio"
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

type AnalyzeBody = {
  portfolioText?: string
  positions?: PortfolioInput[]
  source?: "manual" | "bnb-chain"
}

export async function POST(request: Request) {
  try {
    const rateLimit = await checkRateLimit(request, "portfolio-analyze", 20, 60_000)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many analysis requests. Please wait a minute and retry." },
        { status: 429, headers: rateLimitHeaders(rateLimit) },
      )
    }

    const rawJson = await readJsonBody(request)
    if (!rawJson.ok) return rawJson.response

    const parsedBody = analyzeBodySchema.safeParse(rawJson.data)
    if (!parsedBody.success) {
      return NextResponse.json({ error: validationErrorMessage(parsedBody.error) }, { status: 400 })
    }

    const body = parsedBody.data as AnalyzeBody
    const source = body.source === "bnb-chain" ? "bnb-chain" : "manual"
    const parsedText = body.portfolioText ? parsePortfolioTextDetailed(body.portfolioText) : { inputs: [], invalidRows: [] }
    if (parsedText.invalidRows.length) {
      return NextResponse.json(
        { error: `Could not parse portfolio row(s): ${parsedText.invalidRows.join(", ")}` },
        { status: 400 },
      )
    }

    const inputs = normalizePortfolioInputs(body.positions?.length ? body.positions : parsedText.inputs)

    if (!inputs.length) {
      return NextResponse.json({ error: "Enter at least one portfolio position." }, { status: 400 })
    }

    const symbolsToQuote = Array.from(
      new Set([...inputs.map((input) => input.symbol), ...recommendedQuoteSymbolsForInputs(inputs)]),
    )
    const idsBySymbol = await resolveCmcIds(symbolsToQuote)
    const missing = inputs.filter((input) => !idsBySymbol.has(input.symbol))
    if (missing.length) {
      return NextResponse.json(
        {
          error: `CoinMarketCap could not resolve: ${missing.map((input) => input.symbol).join(", ")}`,
        },
        { status: 422 },
      )
    }

    const quotes = await fetchCmcQuotes(Array.from(idsBySymbol.values()))
    const quotedIds = new Set(quotes.map((quote) => quote.id))
    const missingQuotes = inputs.filter((input) => {
      const id = idsBySymbol.get(input.symbol)
      return id === undefined || !quotedIds.has(id)
    })

    if (missingQuotes.length) {
      return NextResponse.json(
        {
          error: `CoinMarketCap did not return quotes for: ${missingQuotes.map((input) => input.symbol).join(", ")}`,
        },
        { status: 502 },
      )
    }

    const fearGreed = await fetchFearGreedLatest()
    let analysis = buildPortfolioAnalysis({
      inputs,
      quotes,
      fearGreed,
      source,
    })

    const historical = await fetchHistoricalQuotesForIds(
      analysis.strategySpec.reproducibility.cmcIds,
      analysis.strategySpec.backtestConfig.lookbackDays,
    )
    const cmcHistoricalSymbols = new Set(historical.series.map((series) => series.symbol.toUpperCase()))
    const missingHistoricalSymbols = analysis.strategySpec.universe
      .map((asset) => asset.symbol)
      .filter((symbol) => !cmcHistoricalSymbols.has(symbol.toUpperCase()))
    const binanceHistorical = await fetchBinanceDailyKlinesForSymbols(
      missingHistoricalSymbols,
      analysis.strategySpec.backtestConfig.lookbackDays,
    )
    analysis = applyHistoricalBacktest(analysis, [...historical.series, ...binanceHistorical.series])
    if (analysis.backtest.method === "quote-window-proxy" && (historical.errors.length || binanceHistorical.errors.length)) {
      analysis = {
        ...analysis,
        backtest: {
          ...analysis.backtest,
          notes: [
            ...analysis.backtest.notes,
            `Historical replay unavailable for this run: ${[...historical.errors, ...binanceHistorical.errors]
              .slice(0, 3)
              .map((item) => item.message)
              .join("; ")}`,
          ],
        },
      }
    }

    const ai = await generateAiNarrative(analysis)
    analysis.ai = ai
    analysis.aiStatus = ai
      ? "OpenAI narrative generated"
      : hasOpenAiKey()
        ? "Deterministic report used because the OpenAI call was unavailable"
        : "Deterministic report used because OPENAI_API_KEY is not configured"

    return NextResponse.json({ analysis })
  } catch (error) {
    if (error instanceof CmcApiError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: error.status },
      )
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Portfolio analysis failed.",
      },
      { status: 500 },
    )
  }
}
