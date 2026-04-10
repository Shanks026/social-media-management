import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useHeader } from '@/components/misc/header-context'
import { useSubscription } from '@/api/useSubscription'
import { formatDate } from '@/lib/helper'
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

function TrialExpiryBanner({ phase, daysRemaining, endsAt }) {
  const navigate = useNavigate()
  const endDateStr = endsAt ? formatDate(endsAt) : null

  let message
  if (phase === 'grace') {
    message = `Your trial expired${endDateStr ? ` on ${endDateStr}` : ''}. Upgrade today to keep everything running smoothly before your account is locked.`
  } else if (daysRemaining === 0) {
    message = `Your trial expires today${endDateStr ? ` (${endDateStr})` : ''}. Upgrade now to keep full access.`
  } else {
    message = `Your trial expires tomorrow${endDateStr ? ` (${endDateStr})` : ''}. Upgrade now to keep full access.`
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/40 bg-destructive/8 px-4 py-3 text-destructive">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <p className="text-sm font-medium">{message}</p>
      </div>
      <Button variant="destructive" size="sm" onClick={() => navigate('/billing?tab=subscription&scroll=true')} className="shrink-0">
        Upgrade Now
      </Button>
    </div>
  )
}

function SubExpiryBanner({ phase, daysRemaining, endsAt, planName }) {
  const navigate = useNavigate()
  const endDateStr = endsAt ? formatDate(endsAt) : null
  const plan = planName ? planName.charAt(0).toUpperCase() + planName.slice(1) : 'Your'

  let message
  if (phase === 'grace') {
    message = `Your ${plan} subscription expired${endDateStr ? ` on ${endDateStr}` : ''}. Renew today to restore full access before your account is locked.`
  } else if (daysRemaining === 0) {
    message = `Your ${plan} subscription expires today. Renew now to keep uninterrupted access.`
  } else {
    message = `Your ${plan} subscription expires tomorrow. Renew now to keep uninterrupted access.`
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/40 bg-destructive/8 px-4 py-3 text-destructive">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <p className="text-sm font-medium">{message}</p>
      </div>
      <Button variant="destructive" size="sm" onClick={() => navigate('/billing?tab=subscription&scroll=true')} className="shrink-0">
        Renew Now
      </Button>
    </div>
  )
}

export default function Dashboard() {
  const { setHeader } = useHeader()
  const { data: sub } = useSubscription()

  useEffect(() => {
    setHeader({ breadcrumbs: [{ label: 'Dashboard' }], actions: null })
  }, [setHeader])

  const showTrialBanner = sub?.trial_phase === 'critical' || sub?.trial_phase === 'grace'
  const showSubBanner = !sub?.is_trial && (sub?.sub_phase === 'critical' || sub?.sub_phase === 'grace')

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-20 max-w-[1400px] mx-auto flex flex-col gap-4 animate-in fade-in duration-500">
      {/* Row 1: Welcome Message */}
      <DashboardWelcomeMessage />

      {/* Trial expiry banner (critical + grace phases) */}
      {showTrialBanner && (
        <TrialExpiryBanner phase={sub.trial_phase} daysRemaining={sub.trial_days_remaining} endsAt={sub.trial_ends_at} />
      )}

      {/* Subscription expiry banner (critical + grace phases) */}
      {showSubBanner && (
        <SubExpiryBanner phase={sub.sub_phase} daysRemaining={sub.sub_days_remaining} endsAt={sub.subscription_ends_at} planName={sub.plan_name} />
      )}

      {/* Row 2: KPI cards */}
      <AgencyHealthBar />

      {/* Row 3: Meetings/Notes + Pipeline + Scheduled Posts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
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
