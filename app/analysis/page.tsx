import { AppShell } from "@/components/app-shell"
import { ReportPage } from "@/components/report-pages"

export default function AnalysisPage() {
  return (
    <AppShell>
      <ReportPage kind="analysis" />
    </AppShell>
  )
}
