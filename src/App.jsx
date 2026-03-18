import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '../src/context/AuthContext'
import { useSubscription } from './api/useSubscription'
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
import NotesAndReminders from './pages/NotesAndReminders'
import MeetingsPage from './pages/MeetingsPage'
import Dashboard from './pages/dashboard/Dashboard'
import DocumentsPage from './pages/documents/DocumentsPage'
import CampaignsPage from './pages/campaigns/CampaignsPage'
import CampaignDetailPage from './pages/campaigns/CampaignDetailPage'
import CampaignReview from './pages/campaigns/CampaignReview'
import JoinTeam from './pages/JoinTeam'
import ProposalsPage from './pages/proposals/ProposalsPage'
import ProposalDetailPage from './pages/proposals/ProposalDetailPage'
import ProposalReview from './pages/proposals/ProposalReview'
import TrialExpired from './pages/TrialExpired'
import NotFound from './pages/NotFound'

function PublicOnlyRoute({ children }) {
  const { session } = useAuth()
  if (session) return <Navigate to="/dashboard" replace />
  return children
}

function TrialGuardedShell({ user }) {
  const { workspaceUserId } = useAuth()
  const { data: sub, isLoading } = useSubscription()
  if (!workspaceUserId || isLoading) return null
  if (sub?.is_trial_locked) return <Navigate to="/trial-expired" replace />
  return <AppShell user={user} />
}

function SubscriptionsRoute() {
  const { data: sub } = useSubscription()
  if (!sub) return null
  if (!sub.finance_subscriptions) return <Navigate to="/finance/invoices" replace />
  return <SubscriptionsTab />
}

function AppRoutes() {
  const { session, user } = useAuth()

  return (
    <Routes>
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
          <Route element={<TrialGuardedShell user={user} />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/myorganization" element={<MyOrganization />} />
          <Route path="/clients/create" element={<CreateClientPage />} />
          <Route
            path="/clients/:clientId/edit"
            element={<CreateClientPage />}
          />
          <Route path="/clients/:clientId" element={<ClientDetails />} />
          <Route
            path="/clients/:clientId/posts/:postId"
            element={<PostDetails />}
          />
          <Route path="/proposals" element={<ProposalsPage />} />
          <Route path="/proposals/:proposalId" element={<ProposalDetailPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/campaigns/:campaignId" element={<CampaignDetailPage />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="/operations/notes" element={<NotesAndReminders />} />
          <Route path="/operations/meetings" element={<MeetingsPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/calendar" element={<SocialCalendar />} />
          <Route path="/finance" element={<FinanceLayout />}>
            {/* Redirect /finance to /finance/overview */}
            <Route index element={<Navigate to="overview" replace />} />

            <Route path="overview" element={<OverviewTab />} />
            <Route path="subscriptions" element={<SubscriptionsRoute />} />
            <Route path="ledger" element={<LedgerTab />} />
            <Route path="invoices" element={<InvoicesTab />} />
          </Route>
          <Route path="/billing" element={<BillingUsage />} />
          <Route path="/settings" element={<Settings />} />
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
      <AppRoutes />
    </AuthProvider>
  )
}
