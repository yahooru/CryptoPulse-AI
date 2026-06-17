import { AppShell } from "@/components/app-shell"
import { ReportPage } from "@/components/report-pages"

export default function RiskPage() {
  return (
    <AppShell>
      <ReportPage kind="risk" />
    </AppShell>
  )
}
