import { AppShell } from "@/components/app-shell"
import { ReportPage } from "@/components/report-pages"

export default function BacktestingPage() {
  return (
    <AppShell>
      <ReportPage kind="backtesting" />
    </AppShell>
  )
}
