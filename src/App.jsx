import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { AuthProvider, useAuth } from '../src/context/AuthContext'
import { useSubscription } from './api/useSubscription'
import { usePermissions } from './api/usePermissions'
import { useMaintenanceMode } from './api/appConfig'
import MaintenanceScreen from './components/MaintenanceScreen'
import LoginPage from './components/auth/login'
import SignupPage from './components/auth/signup'
import { AppShell } from './components/misc/AppShell'
import Clients from './pages/clients/Clients'
import ClientDetails from './pages/clients/ClientDetails'
import PostDetails from './pages/posts/postDetails/PostDetails'
import PublicReview from './pages/PublicReview'
import Settings from './pages/Settings'
import SocialCalendar from './pages/calendar/ContentCalendar'
import MyOrganization from './pages/MyOrganization'
import FinanceLayout from './pages/finance/FinanceLayout'
import OverviewTab from './pages/finance/FinancialOverviewTab'
import SubscriptionsTab from './pages/finance/SubscriptionsTab'
import LedgerTab from './pages/finance/LedgerTab'
import InvoicesTab from './pages/finance/InvoicesTab'
import Posts from './pages/Posts'
import BillingUsage from './pages/billingAndUsage/BillingUsage'
import CreateClientPage from './pages/clients/CreateClientPage'
import TasksAndReminders from './pages/TasksAndReminders'
import Notes from './pages/Notes'
import NoteEditorPage from './pages/NoteEditorPage'
import MeetingsPage from './pages/MeetingsPage'
import Dashboard from './pages/dashboard/Dashboard'
import DocumentsPage from './pages/documents/DocumentsPage'
import ReportsPage from './pages/reports/ReportsPage'
import CampaignsPage from './pages/campaigns/CampaignsPage'
import CampaignDetailPage from './pages/campaigns/CampaignDetailPage'
import CampaignReview from './pages/campaigns/CampaignReview'
import JoinTeam from './pages/JoinTeam'
import ProspectsPage from './pages/prospects/ProspectsPage'
import ProspectDetailPage from './pages/prospects/ProspectDetailPage'
import ProposalsPage from './pages/proposals/ProposalsPage'
import ProposalDetailPage from './pages/proposals/ProposalDetailPage'
import ProposalReview from './pages/proposals/ProposalReview'
import TrialExpired from './pages/TrialExpired'
import SubscriptionExpired from './pages/SubscriptionExpired'
import NotFound from './pages/NotFound'
import HelpPage from './pages/help/HelpPage'
import PoliciesPage from './pages/help/PoliciesPage'
import TeamPage from './pages/TeamPage'
import AdsPage from './pages/ads/AdsPage'
import PartnershipsPage from './pages/partnerships/PartnershipsPage'

function MaintenanceGate({ children }) {
  const queryClient = useQueryClient()
  const { data } = useMaintenanceMode()

  useEffect(() => {
    const channel = supabase
      .channel('maintenance_mode_watch')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'app_config',
        filter: 'key=eq.maintenance_mode',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['app-config', 'maintenance_mode'] })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [queryClient])

  // Maintenance-off is the safe default — always render the app. Only REPLACE it
  // with the maintenance screen when the flag is explicitly active. Never gate on
  // the query's loading/pending state: returning null here unmounts the entire
  // app tree (login included), so any refetch/reset of this query blanks the
  // whole page and remounts it with a fade — the reported "flash".
  if (data?.is_active) return <MaintenanceScreen message={data.message} />
  return children
}

function PublicOnlyRoute({ children }) {
  const { session } = useAuth()
  if (session) return <Navigate to="/dashboard" replace />
  return children
}

const TGS_BLANK = <div className="h-screen w-full bg-background" />

function TrialGuardedShell({ user }) {
  const { workspaceUserId } = useAuth()
  const { data: sub } = useSubscription()
  const [hasShown, setHasShown] = useState(false)

  // First-load gate: wait for the workspace + subscription before showing anything.
  const ready = !!workspaceUserId && !!sub

  // Once the shell has been shown, keep it mounted. Transient subscription
  // states (refetch on invalidate, token refresh, cache wipe on logout) must
  // never swap AppShell for a blank screen — that unmount/remount is the
  // post-login/logout "flash". A genuine sign-out clears `session` upstream,
  // which unmounts this route entirely and redirects to /login.
  if (ready && !hasShown) setHasShown(true)

  if (!hasShown && !ready) return TGS_BLANK
  if (sub?.is_trial_locked) return <Navigate to="/trial-expired" replace />
  if (sub?.is_sub_locked) return <Navigate to="/subscription-expired" replace />
  return <AppShell user={user} />
}

// RBAC route guard — redirects to /dashboard when the current user lacks `cap`.
// Renders nothing until the role is resolved, so an owner is never briefly
// redirected during the initial auth resolution.
function RequirePermission({ cap, children }) {
  const { userRole } = useAuth()
  const perms = usePermissions()
  if (!userRole) return null
  if (!perms[cap]) return <Navigate to="/dashboard" replace />
  return children
}

function SubscriptionsRoute() {
  const { data: sub } = useSubscription()
  if (!sub) return null
  if (!sub.finance_subscriptions) return <Navigate to="/finance/invoices" replace />
  return <SubscriptionsTab />
}

function ReportsRoute() {
  const { data: sub } = useSubscription()
  if (!sub) return null
  if (!sub.reports) return <Navigate to="/dashboard" replace />
  return <ReportsPage />
}

function AppRoutes() {
  const { session, user } = useAuth()

  return (
    <Routes>
      <Route path="/policies" element={<PoliciesPage />} />
      <Route path="/review/:token" element={<PublicReview />} />
      <Route path="/campaign-review/:token" element={<CampaignReview />} />
      <Route path="/proposal/:token" element={<ProposalReview />} />
      <Route path="/join/:token" element={<JoinTeam />} />
      <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
      <Route path="/signup" element={<PublicOnlyRoute><SignupPage /></PublicOnlyRoute>} />

      {session ? (
        <>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/trial-expired" element={<TrialExpired />} />
          <Route path="/subscription-expired" element={<SubscriptionExpired />} />
          <Route element={<TrialGuardedShell user={user} />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/myorganization" element={<MyOrganization />} />
          <Route path="/partnerships" element={<PartnershipsPage />} />
          <Route path="/clients/create" element={<RequirePermission cap="canCreateClients"><CreateClientPage /></RequirePermission>} />
          <Route
            path="/clients/:clientId/edit"
            element={<RequirePermission cap="canCreateClients"><CreateClientPage /></RequirePermission>}
          />
          <Route path="/clients/:clientId" element={<ClientDetails />} />
          <Route
            path="/clients/:clientId/posts/:postId"
            element={<PostDetails />}
          />
          <Route path="/prospects" element={<RequirePermission cap="prospects"><ProspectsPage /></RequirePermission>} />
          <Route path="/prospects/:prospectId" element={<RequirePermission cap="prospects"><ProspectDetailPage /></RequirePermission>} />
          <Route path="/proposals" element={<RequirePermission cap="proposals"><ProposalsPage /></RequirePermission>} />
          <Route path="/proposals/:proposalId" element={<RequirePermission cap="proposals"><ProposalDetailPage /></RequirePermission>} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/campaigns/:campaignId" element={<CampaignDetailPage />} />
          <Route path="/ads" element={<AdsPage />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="/operations/tasks" element={<TasksAndReminders />} />
          <Route path="/operations/notes" element={<Notes />} />
          <Route path="/operations/notes/:noteId" element={<NoteEditorPage />} />
          <Route path="/operations/meetings" element={<MeetingsPage />} />
          <Route path="/documents" element={<RequirePermission cap="hasDocuments"><DocumentsPage /></RequirePermission>} />
          <Route path="/reports" element={<RequirePermission cap="reports"><ReportsRoute /></RequirePermission>} />
          <Route path="/calendar" element={<SocialCalendar />} />
          <Route path="/finance" element={<RequirePermission cap="finance"><FinanceLayout /></RequirePermission>}>
            {/* Redirect /finance to /finance/overview */}
            <Route index element={<Navigate to="overview" replace />} />

            <Route path="overview" element={<OverviewTab />} />
            <Route path="subscriptions" element={<SubscriptionsRoute />} />
            <Route path="ledger" element={<LedgerTab />} />
            <Route path="invoices" element={<InvoicesTab />} />
          </Route>
          <Route path="/billing" element={<RequirePermission cap="canBilling"><BillingUsage /></RequirePermission>} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/help" element={<HelpPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
        </>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <MaintenanceGate>
        <AppRoutes />
      </MaintenanceGate>
    </AuthProvider>
  )
}
