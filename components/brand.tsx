import Link from "next/link"
import { Activity } from "lucide-react"

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="cp-brand" aria-label="CryptoPulse AI home">
      <span className="cp-brand-mark">
        <Activity className="h-5 w-5" aria-hidden="true" />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-tight text-white">CryptoPulse AI</span>
          <span className="block text-[11px] leading-tight text-white/50">CMC Strategy Skill</span>
        </span>
      )}
    </Link>
  )
}
