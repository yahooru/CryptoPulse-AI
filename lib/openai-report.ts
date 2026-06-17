import type { AiNarrative, PortfolioAnalysis } from "@/lib/portfolio"
import { fetchWithTimeout } from "@/lib/fetch-timeout"

const OPENAI_URL = "https://api.openai.com/v1/responses"

export function hasOpenAiKey() {
  return Boolean(process.env.OPENAI_API_KEY)
}

export async function generateAiNarrative(analysis: PortfolioAnalysis): Promise<AiNarrative | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini"
  const compactAnalysis = {
    scores: {
      health: analysis.healthScore,
      risk: analysis.riskScore,
      diversification: analysis.diversificationScore,
      regime: analysis.marketRegime,
    },
    positions: analysis.positions.map((position) => ({
      symbol: position.symbol,
      role: position.role,
      weight: position.weight,
      change7d: position.change7d,
      change30d: position.change30d,
      riskTier: position.riskTier,
    })),
    recommendations: analysis.recommendations.slice(0, 8),
    backtest: analysis.backtest,
  }

  try {
    const response = await fetchWithTimeout(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content:
              "You are CryptoPulse AI, a portfolio-risk assistant for crypto allocation research. Return concise, non-advisory portfolio reasoning only. Do not promise profit. Do not recommend live trades. Focus on risk, replay evidence, and reviewable allocation rules.",
          },
          {
            role: "user",
            content: JSON.stringify(compactAnalysis),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "crypto_pulse_ai_narrative",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["thesis", "portfolioDoctorNote", "strategySummary", "riskDisclosure"],
              properties: {
                thesis: { type: "string" },
                portfolioDoctorNote: { type: "string" },
                strategySummary: { type: "string" },
                riskDisclosure: { type: "string" },
              },
            },
          },
        },
      }),
    }, 18_000, "OpenAI")

    if (!response.ok) {
      return null
    }

    const json = await response.json()
    const text = extractOutputText(json)
    if (!text) return null
    return JSON.parse(text) as AiNarrative
  } catch {
    return null
  }
}

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null
  const direct = (payload as { output_text?: unknown }).output_text
  if (typeof direct === "string") return direct

  const output = (payload as { output?: unknown }).output
  if (!Array.isArray(output)) return null

  for (const item of output) {
    if (!item || typeof item !== "object") continue
    const content = (item as { content?: unknown }).content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (!part || typeof part !== "object") continue
      const text = (part as { text?: unknown }).text
      if (typeof text === "string") return text
    }
  }

  return null
}
