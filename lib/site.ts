export const SITE_NAME = "CryptoPulse AI"
export const SITE_DESCRIPTION =
  "CMC-backed portfolio diagnosis, BNB Chain wallet reads, and backtestable strategy specs for crypto portfolios."

export function getSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cryptopulse-ai.vercel.app"
  try {
    return new URL(raw)
  } catch {
    return new URL("https://cryptopulse-ai.vercel.app")
  }
}
