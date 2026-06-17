import { describe, expect, it } from "vitest"

import { analyzeBodySchema, onchainBodySchema, readJsonBody } from "../lib/api-validation"

describe("API validation", () => {
  it("rejects non-array positions payloads", () => {
    const parsed = analyzeBodySchema.safeParse({
      positions: { symbol: "BTC", weight: 100 },
    })

    expect(parsed.success).toBe(false)
  })

  it("rejects non-string wallet addresses", () => {
    const parsed = onchainBodySchema.safeParse({
      walletAddress: 123,
    })

    expect(parsed.success).toBe(false)
  })

  it("accepts a minimal manual portfolio request", () => {
    const parsed = analyzeBodySchema.safeParse({
      portfolioText: "BTC 60%\nETH 40%",
      source: "manual",
    })

    expect(parsed.success).toBe(true)
  })

  it("rejects streamed JSON bodies over the byte cap", async () => {
    const largeBody = JSON.stringify({
      portfolioText: `BTC ${"1".repeat(80_000)}%`,
    })
    const request = new Request("https://cryptopulse.local/api/portfolio/analyze", {
      method: "POST",
      body: largeBody,
      headers: {
        "content-type": "application/json",
      },
    })

    const parsed = await readJsonBody(request)

    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.response.status).toBe(413)
    }
  })

  it("accepts custom token contracts for wallet reads", () => {
    const parsed = onchainBodySchema.safeParse({
      walletAddress: "0x0000000000000000000000000000000000000001",
      customTokens: [
        {
          address: "0x0000000000000000000000000000000000000002",
          symbol: "ABC",
          decimals: 18,
        },
      ],
    })

    expect(parsed.success).toBe(true)
  })
})
