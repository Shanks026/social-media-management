import { useEffect } from 'react'
import { useHeader } from '@/components/misc/header-context'
import DashboardWelcomeMessage from './DashboardWelcomeMessage'
import AgencyHealthBar from './AgencyHealthBar'
import DashboardMeetingsNotes from './DashboardMeetingsNotes'
import ContentPipelineBar from './ContentPipelineBar'
import DashboardWeekTimeline from './DashboardWeekTimeline'
import DashboardSocialMediaUsage from './DashboardSocialMediaUsage'
import LifetimeRevenue from './LifetimeRevenue'
import FinancialSnapshot from './FinancialSnapshot'
import DashboardInvoiceTable from './DashboardInvoiceTable'
import ClientHealthGrid from './ClientHealthGrid'

export default function Dashboard() {
  const { setHeader } = useHeader()

  useEffect(() => {
    setHeader({ breadcrumbs: [{ label: 'Dashboard' }], actions: null })
  }, [setHeader])

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-20 max-w-[1400px] mx-auto flex flex-col gap-4 animate-in fade-in duration-500">
      {/* Row 1: Welcome Message */}
      <DashboardWelcomeMessage />

      {/* Row 2: KPI cards */}
      <AgencyHealthBar />

      {/* Row 3: Meetings/Notes + Pipeline + Scheduled Posts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        <DashboardMeetingsNotes />
        <ContentPipelineBar />
        <DashboardWeekTimeline />
      </div>

      {/* Row 4: Finance + Social Media */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        <FinancialSnapshot />
        <LifetimeRevenue />
        <DashboardSocialMediaUsage />
      </div>

      {/* Row 5: Recent invoices table */}
      <DashboardInvoiceTable />

      {/* Row 6: Client content health grid */}
      <ClientHealthGrid />
    </div>
  )
}
