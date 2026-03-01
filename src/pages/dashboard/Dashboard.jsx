import { useEffect } from 'react'
import { useHeader } from '@/components/misc/header-context'
import DashboardWelcomeMessage from './DashboardWelcomeMessage'
import AgencyHealthBar from './AgencyHealthBar'
import DashboardMeetingsNotes from './DashboardMeetingsNotes'
import ContentPipelineBar from './ContentPipelineBar'
import DashboardScheduledPosts from './DashboardScheduledPosts'
import DashboardSocialMediaUsage from './DashboardSocialMediaUsage'
import FinancialSnapshot from './FinancialSnapshot'
import DashboardInvoiceTable from './DashboardInvoiceTable'
import ClientHealthGrid from './ClientHealthGrid'

export default function Dashboard() {
  const { setHeader } = useHeader()

  useEffect(() => {
    setHeader({ breadcrumbs: [{ label: 'Dashboard' }], actions: null })
  }, [setHeader])

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-20 max-w-[1440px] mx-auto flex flex-col gap-6 animate-in fade-in duration-500">
      {/* Row 1: Welcome Message */}
      <DashboardWelcomeMessage />

      {/* Row 2: KPI cards */}
      <AgencyHealthBar />

      {/* Row 3: Middle Section — left 1/3 (meetings/notes), right 2/3 (pipeline + charts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <DashboardMeetingsNotes />
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Workflow pipeline + scheduled posts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <ContentPipelineBar />
            <DashboardScheduledPosts />
          </div>

          {/* Social media usage + profitability */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <DashboardSocialMediaUsage />
            <FinancialSnapshot />
          </div>
        </div>
      </div>

      {/* Row 4: Recent invoices table */}
      <DashboardInvoiceTable />

      {/* Row 5: Client content health grid */}
      <ClientHealthGrid />
    </div>
  )
}
