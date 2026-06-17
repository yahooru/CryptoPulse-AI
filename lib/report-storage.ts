import type { PortfolioAnalysis } from "@/lib/portfolio"

export const REPORT_STORAGE_KEY = "cryptopulse:last-analysis"
const REPORT_STORAGE_VERSION = 1

type StoredReport = {
  version: typeof REPORT_STORAGE_VERSION
  analysis: PortfolioAnalysis
}

export function readStoredAnalysis(storage: Storage): PortfolioAnalysis | null {
  const stored = storage.getItem(REPORT_STORAGE_KEY)
  if (!stored) return null

  const parsed = JSON.parse(stored) as PortfolioAnalysis | StoredReport
  if (isStoredReport(parsed)) return parsed.analysis

  if (isLegacyAnalysis(parsed)) {
    writeStoredAnalysis(storage, parsed)
    return parsed
  }

  return null
}

export function writeStoredAnalysis(storage: Storage, analysis: PortfolioAnalysis) {
  const payload: StoredReport = {
    version: REPORT_STORAGE_VERSION,
    analysis,
  }
  storage.setItem(REPORT_STORAGE_KEY, JSON.stringify(payload))
}

export function clearStoredAnalysis(storage: Storage) {
  storage.removeItem(REPORT_STORAGE_KEY)
}

function isStoredReport(value: PortfolioAnalysis | StoredReport): value is StoredReport {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    value.version === REPORT_STORAGE_VERSION &&
    "analysis" in value
  )
}

function isLegacyAnalysis(value: PortfolioAnalysis | StoredReport): value is PortfolioAnalysis {
  return typeof value === "object" && value !== null && "strategySpec" in value && "positions" in value
}
