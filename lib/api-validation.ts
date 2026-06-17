import { NextResponse } from "next/server"
import { z } from "zod"

const MAX_JSON_BYTES = 32_768

const symbolSchema = z
  .string()
  .trim()
  .min(1, "Symbol is required.")
  .max(16, "Symbol is too long.")
  .regex(/^[a-zA-Z0-9.-]+$/, "Symbol can contain letters, numbers, dot, or dash only.")
  .transform((symbol) => symbol.toUpperCase())

const portfolioNumberSchema = z.number().finite().nonnegative().max(1_000_000_000)

export const portfolioInputSchema = z
  .object({
    symbol: symbolSchema,
    weight: portfolioNumberSchema.max(10_000).optional(),
    amount: portfolioNumberSchema.optional(),
    usdValue: portfolioNumberSchema.optional(),
  })
  .strict()

export const analyzeBodySchema = z
  .object({
    portfolioText: z.string().max(5_000, "Portfolio input is too large.").optional(),
    positions: z.array(portfolioInputSchema).max(50, "At most 50 positions are supported.").optional(),
    source: z.enum(["manual", "bnb-chain"]).optional(),
  })
  .strict()
  .refine((body) => Boolean(body.portfolioText?.trim()) || Boolean(body.positions?.length), {
    message: "Enter at least one portfolio position.",
  })

export const onchainBodySchema = z
  .object({
    walletAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/, "Connect a valid BNB Chain wallet address."),
  })
  .strict()

export function rejectLargeJsonBody(request: Request) {
  const rawLength = request.headers.get("content-length")
  const length = rawLength ? Number(rawLength) : 0
  if (Number.isFinite(length) && length > MAX_JSON_BYTES) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 })
  }
  return null
}

export async function readJsonBody(request: Request): Promise<
  | {
      ok: true
      data: unknown
    }
  | {
      ok: false
      response: NextResponse
    }
> {
  const bodySizeError = rejectLargeJsonBody(request)
  if (bodySizeError) return { ok: false, response: bodySizeError }

  if (!request.body) {
    return { ok: false, response: NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }) }
  }

  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let receivedBytes = 0
  let text = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      receivedBytes += value.byteLength
      if (receivedBytes > MAX_JSON_BYTES) {
        return { ok: false, response: NextResponse.json({ error: "Request body is too large." }, { status: 413 }) }
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }) }
  }

  try {
    return { ok: true, data: JSON.parse(text) }
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }) }
  }
}

export function validationErrorMessage(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join(" ")
}
