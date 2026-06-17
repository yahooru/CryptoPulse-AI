import { NextResponse } from "next/server"

import { onchainBodySchema, readJsonBody, validationErrorMessage } from "@/lib/api-validation"
import { CmcApiError } from "@/lib/cmc"
import { BSC_SUPPORTED_ASSET_SYMBOLS, readBnbChainPortfolio } from "@/lib/onchain"
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const rateLimit = await checkRateLimit(request, "onchain-portfolio", 30, 60_000)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many wallet reads. Please wait a minute and retry." },
        { status: 429, headers: rateLimitHeaders(rateLimit) },
      )
    }

    const rawJson = await readJsonBody(request)
    if (!rawJson.ok) return rawJson.response

    const parsedBody = onchainBodySchema.safeParse(rawJson.data)
    if (!parsedBody.success) {
      return NextResponse.json({ error: validationErrorMessage(parsedBody.error) }, { status: 400 })
    }

    const walletAddress = parsedBody.data.walletAddress
    const holdings = await readBnbChainPortfolio(walletAddress)
    return NextResponse.json({ walletAddress, holdings, supportedSymbols: BSC_SUPPORTED_ASSET_SYMBOLS })
  } catch (error) {
    if (error instanceof CmcApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to read BNB Chain portfolio.",
      },
      { status: 500 },
    )
  }
}
