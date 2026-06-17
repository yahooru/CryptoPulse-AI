import { AppShell } from "@/components/app-shell"
import { ReportPage } from "@/components/report-pages"

export default function RecommendationsPage() {
  return (
    <AppShell>
      <ReportPage kind="recommendations" />
    </AppShell>
  )
}
