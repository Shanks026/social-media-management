import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { AuthProvider, useAuth } from '../src/context/AuthContext'
import { useSubscription } from './api/useSubscription'
import { usePermissions } from './api/usePermissions'
import { useMaintenanceMode } from './api/appConfig'
import MaintenanceScreen from './components/MaintenanceScreen'
import { AppShell } from './components/misc/AppShell'
import { RouteFallback } from './components/misc/RouteFallback'
import { PlanUpgradePrompt } from './components/misc/PlanUpgradePrompt'

// Every page is its own chunk, downloaded the first time its route is visited.
// The shell (auth, AppShell, route guards) stays in the entry chunk; the
// Suspense boundaries that catch these live below, in AppShell's outlet, and
// in FinanceLayout's outlet — all rendering the shared RouteFallback.
const LoginPage = lazy(() => import('./components/auth/login'))
const SignupPage = lazy(() => import('./components/auth/signup'))
const Clients = lazy(() => import('./pages/clients/Clients'))
const ClientDetails = lazy(() => import('./pages/clients/ClientDetails'))
const PostDetails = lazy(() => import('./pages/posts/postDetails/PostDetails'))
const PublicReview = lazy(() => import('./pages/PublicReview'))
const Settings = lazy(() => import('./pages/Settings'))
const SocialCalendar = lazy(() => import('./pages/calendar/ContentCalendar'))
const MyOrganization = lazy(() => import('./pages/MyOrganization'))
const FinanceLayout = lazy(() => import('./pages/finance/FinanceLayout'))
const OverviewTab = lazy(() => import('./pages/finance/FinancialOverviewTab'))
const SubscriptionsTab = lazy(() => import('./pages/finance/SubscriptionsTab'))
const LedgerTab = lazy(() => import('./pages/finance/LedgerTab'))
const InvoicesTab = lazy(() => import('./pages/finance/InvoicesTab'))
const Posts = lazy(() => import('./pages/Posts'))
const BillingUsage = lazy(() => import('./pages/billingAndUsage/BillingUsage'))
const CreateClientPage = lazy(() => import('./pages/clients/CreateClientPage'))
const TasksAndReminders = lazy(() => import('./pages/TasksAndReminders'))
const TaskDetailPage = lazy(() => import('./pages/tasks/TaskDetailPage'))
const Notes = lazy(() => import('./pages/Notes'))
const NoteEditorPage = lazy(() => import('./pages/NoteEditorPage'))
const MeetingsPage = lazy(() => import('./pages/MeetingsPage'))
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'))
const DocumentsPage = lazy(() => import('./pages/documents/DocumentsPage'))
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'))
const CampaignsPage = lazy(() => import('./pages/campaigns/CampaignsPage'))
const CampaignDetailPage = lazy(() => import('./pages/campaigns/CampaignDetailPage'))
const CampaignReview = lazy(() => import('./pages/campaigns/CampaignReview'))
const JoinTeam = lazy(() => import('./pages/JoinTeam'))
const ProspectsPage = lazy(() => import('./pages/prospects/ProspectsPage'))
const ProspectDetailPage = lazy(() => import('./pages/prospects/ProspectDetailPage'))
const ProposalsPage = lazy(() => import('./pages/proposals/ProposalsPage'))
const ProposalDetailPage = lazy(() => import('./pages/proposals/ProposalDetailPage'))
const ProposalReview = lazy(() => import('./pages/proposals/ProposalReview'))
const TrialExpired = lazy(() => import('./pages/TrialExpired'))
const SubscriptionExpired = lazy(() => import('./pages/SubscriptionExpired'))
const NoWorkspaceAccess = lazy(() => import('./pages/NoWorkspaceAccess'))
const NotFound = lazy(() => import('./pages/NotFound'))
const PublicNotFound = lazy(() => import('./pages/PublicNotFound'))
const HelpPage = lazy(() => import('./pages/help/HelpPage'))
const PoliciesPage = lazy(() => import('./pages/help/PoliciesPage'))
const TeamPage = lazy(() => import('./pages/TeamPage'))
const WelcomePage = lazy(() => import('./pages/welcome/WelcomePage'))
const AdsPage = lazy(() => import('./pages/ads/AdsPage'))
const PartnershipsPage = lazy(() => import('./pages/partnerships/PartnershipsPage'))
const ApprovalsPage = lazy(() => import('./pages/approvals/ApprovalsPage'))
const SubmissionsPage = lazy(() => import('./pages/submissions/SubmissionsPage'))
const ChatPage = lazy(() => import('./pages/chat/ChatPage'))

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
  const { workspaceUserId, removedFromWorkspace, workspaceVerified } = useAuth()
  const { data: sub } = useSubscription()
  const [hasShown, setHasShown] = useState(false)

  // Removed members never get a workspaceUserId, so they'd otherwise sit on
  // TGS_BLANK forever waiting for `ready` — check this before that gate.
  if (removedFromWorkspace) return <Navigate to="/no-access" replace />

  // First-load gate: wait for the workspace + subscription before showing
  // anything — and specifically for a VERIFIED workspace, not the optimistic
  // sessionStorage-cached one AuthContext applies instantly on every auth
  // event. Without `workspaceVerified`, a member removed since their last
  // visit could flash the old dashboard for a frame before the real
  // agency_members check corrects it to `removedFromWorkspace`. Once
  // `hasShown` latches below, this no longer gates anything — a later
  // token refresh briefly toggling `workspaceVerified` won't blank an
  // already-mounted AppShell.
  const ready = !!workspaceUserId && !!sub && workspaceVerified

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
  if (!sub.finance_subscriptions) {
    return (
      <PlanUpgradePrompt
        title="Expense subscriptions are a Velocity feature"
        description="Track recurring vendor and tool expenses automatically — available on Velocity and above."
      />
    )
  }
  return <SubscriptionsTab />
}

function ReportsRoute() {
  const { data: sub } = useSubscription()
  if (!sub) return null
  if (!sub.reports) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <PlanUpgradePrompt
          title="Client reports are a Velocity feature"
          description="Generate polished, shareable client reports — available on Velocity and above."
        />
      </div>
    )
  }
  return <ReportsPage />
}

function ChatRoute() {
  const { data: sub } = useSubscription()
  if (!sub) return null
  if (!sub.chat) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <PlanUpgradePrompt
          title="Workspace chat is a Velocity feature"
          description="Chat with your team in a shared workspace channel or 1:1 DMs — available on Velocity and above."
        />
      </div>
    )
  }
  return <ChatPage />
}

// Deliverable detail used to live at /clients/:clientId/posts/:postId. Old
// links (stored notification rows, bookmarks) forward to the current path.
function LegacyPostRedirect() {
  const { clientId, postId } = useParams()
  return <Navigate to={`/clients/${clientId}/deliverables/${postId}`} replace />
}

function AppRoutes() {
  const { session, user, loading } = useAuth()

  // Nothing is mounted until the stored session has actually been read.
  //
  // The route tree below is split on `session`, and the unauthenticated half's
  // only route is `*` -> Navigate to /login. So while the initial
  // supabase.auth.getSession() was still in flight, `session` was null and ANY
  // protected URL matched that catch-all and redirected — with `replace`, so
  // the intended destination was destroyed too. That is the refresh-lands-on-
  // login behaviour, and the reason a fresh sign-in bounced back once before
  // working: the redirect fired in the window before setSession() committed.
  //
  // `loading` flips in a .finally() on that first read, so this resolves on
  // both the signed-in and signed-out paths.
  if (loading) return <div className="h-screen w-full bg-background" />

  return (
    <Suspense fallback={<RouteFallback className="h-screen" />}>
    <Routes>
      <Route path="/policies" element={<PoliciesPage />} />
      <Route path="/review/:token" element={<PublicReview />} />
      <Route path="/review/*" element={<PublicNotFound />} />
      <Route path="/campaign-review/:token" element={<CampaignReview />} />
      <Route path="/campaign-review/*" element={<PublicNotFound />} />
      <Route path="/proposal/:token" element={<ProposalReview />} />
      <Route path="/proposal/*" element={<PublicNotFound />} />
      <Route path="/join/:token" element={<JoinTeam />} />
      <Route path="/join/*" element={<PublicNotFound />} />
      <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
      <Route path="/signup" element={<PublicOnlyRoute><SignupPage /></PublicOnlyRoute>} />

      {session ? (
        <>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/trial-expired" element={<TrialExpired />} />
          <Route path="/subscription-expired" element={<SubscriptionExpired />} />
          <Route path="/no-access" element={<NoWorkspaceAccess />} />
          {/* Post-setup feature showcase. Deliberately outside TrialGuardedShell
              so it renders full-page without the sidebar/header chrome. */}
          <Route path="/welcome" element={<WelcomePage />} />
          <Route element={<TrialGuardedShell user={user} />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chat" element={<ChatRoute />} />
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
            path="/clients/:clientId/deliverables/:postId"
            element={<PostDetails />}
          />
          {/* Legacy path — links minted before the rename (notification rows,
              bookmarks, pasted URLs) still resolve. */}
          <Route
            path="/clients/:clientId/posts/:postId"
            element={<LegacyPostRedirect />}
          />
          <Route path="/prospects" element={<RequirePermission cap="prospects"><ProspectsPage /></RequirePermission>} />
          <Route path="/prospects/:prospectId" element={<RequirePermission cap="prospects"><ProspectDetailPage /></RequirePermission>} />
          <Route path="/proposals" element={<RequirePermission cap="proposals"><ProposalsPage /></RequirePermission>} />
          <Route path="/proposals/:proposalId" element={<RequirePermission cap="proposals"><ProposalDetailPage /></RequirePermission>} />
          <Route path="/submissions" element={<RequirePermission cap="isTeamMember"><SubmissionsPage /></RequirePermission>} />
          <Route path="/approvals" element={<RequirePermission cap="canSendDeliverables"><ApprovalsPage /></RequirePermission>} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/campaigns/:campaignId" element={<CampaignDetailPage />} />
          <Route path="/ads" element={<AdsPage />} />
          <Route path="/deliverables" element={<Posts />} />
          <Route path="/posts" element={<Navigate to="/deliverables" replace />} />
          <Route path="/tasks" element={<TasksAndReminders />} />
          <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
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
    </Suspense>
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
