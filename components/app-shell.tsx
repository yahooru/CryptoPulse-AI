"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, Brain, Gauge, LayoutDashboard, LineChart, ShieldAlert, WandSparkles } from "lucide-react"

import { AnimatedMarketBackground } from "@/components/animated-market-background"
import { Brand } from "@/components/brand"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analysis", label: "Analysis", icon: BarChart3 },
  { href: "/risk", label: "Risk", icon: ShieldAlert },
  { href: "/recommendations", label: "Recommendations", icon: WandSparkles },
  { href: "/backtesting", label: "Backtesting", icon: LineChart },
  { href: "/reasoning", label: "Reasoning", icon: Brain },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="cp-app min-h-screen">
      <AnimatedMarketBackground compact />
      <header className="cp-app-header">
        <Brand />
        <Link href="/dashboard" className="cp-quiet-button">
          <Gauge className="h-4 w-4" aria-hidden="true" />
          Run Doctor
        </Link>
      </header>

      <div className="cp-app-grid">
        <aside className="cp-sidebar" aria-label="CryptoPulse navigation">
          <nav className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:flex lg:flex-col">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("cp-side-link", active && "is-active")}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </aside>
        <main className="min-w-0 pb-12">{children}</main>
      </div>
    </div>
  )
}
