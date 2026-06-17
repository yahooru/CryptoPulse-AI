import { createHash } from "node:crypto"

type Bucket = {
  count: number
  resetAt: number
}

type RateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export async function checkRateLimit(
  request: Request,
  namespace: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const external = await checkExternalRateLimit(request, namespace, limit, windowMs)
  if (external) return external
  return checkMemoryRateLimit(request, namespace, limit, windowMs)
}

function checkMemoryRateLimit(
  request: Request,
  namespace: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now()
  const key = `${namespace}:${hashKey(clientKey(request))}`
  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    cleanupExpired(now)
    return { allowed: true, limit, remaining: limit - 1, resetAt }
  }

  current.count += 1
  const remaining = Math.max(0, limit - current.count)
  return {
    allowed: current.count <= limit,
    limit,
    remaining,
    resetAt: current.resetAt,
  }
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  }
}

function clientKey(request: Request) {
  if (shouldTrustProxyHeaders()) {
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    const realIp = request.headers.get("x-real-ip")?.trim()
    const cfIp = request.headers.get("cf-connecting-ip")?.trim()
    if (forwardedFor || realIp || cfIp) return forwardedFor || realIp || cfIp || "proxy"
  }
  return "local"
}

function cleanupExpired(now: number) {
  if (buckets.size < 500) return
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

async function checkExternalRateLimit(
  request: Request,
  namespace: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult | null> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!redisUrl || !redisToken) return null

  const now = Date.now()
  const bucketStart = Math.floor(now / windowMs) * windowMs
  const resetAt = bucketStart + windowMs
  const key = `cryptopulse:rate-limit:${namespace}:${hashKey(clientKey(request))}:${bucketStart}`
  const ttlSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000) + 2)

  try {
    const response = await fetch(`${redisUrl.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, ttlSeconds],
      ]),
      cache: "no-store",
    })

    if (!response.ok) return null
    const json = (await response.json()) as Array<{ result?: unknown }>
    const count = Number(json[0]?.result)
    if (!Number.isFinite(count)) return null

    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    }
  } catch {
    return null
  }
}

function shouldTrustProxyHeaders() {
  return process.env.RATE_LIMIT_TRUST_PROXY === "true" || process.env.VERCEL === "1"
}

function hashKey(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32)
}
