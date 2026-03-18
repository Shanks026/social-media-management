import { useState, useRef } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useSubscription } from '@/api/useSubscription'
import { Button } from '@/components/ui/button'
import { ChevronDown, LogOut } from 'lucide-react'
import {
  plans,
  PlanCard,
  UpgradeRequestDialog,
} from '@/pages/billingAndUsage/TertiarySubscriptionTab'

const APP_NAME = 'Tercero'
const LANDSCAPE_LOGO = '/TerceroLand.svg'

export default function TrialExpired() {
  const navigate = useNavigate()
  const { workspaceUserId } = useAuth()
  const { data: sub, isLoading: subLoading } = useSubscription()
  const plansRef = useRef(null)

  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)

  const agencyLogo = sub?.logo_url
  const agencyName = sub?.agency_name && sub.agency_name !== APP_NAME ? sub.agency_name : null
  const clientCount = sub?.client_count ?? 0

  const { data: postCount = 0 } = useQuery({
    queryKey: ['trial-expired-post-count', workspaceUserId],
    enabled: !!workspaceUserId,
    queryFn: async () => {
      const { count } = await supabase
        .from('posts')
        .select('id, clients!inner(user_id)', { count: 'exact', head: true })
        .eq('clients.user_id', workspaceUserId)
      return count || 0
    },
    staleTime: Infinity,
  })

  const handleContactTeam = (plan) => {
    setSelectedPlan(plan)
    setUpgradeDialogOpen(true)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const scrollToPlans = () => {
    plansRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (subLoading) return null
  if (!sub?.is_trial_locked) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen bg-background flex flex-col w-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-border/40">
        <div className="flex items-center gap-4">
          <div
            className="h-6 w-24 bg-foreground shrink-0"
            style={{
              maskImage: `url(${LANDSCAPE_LOGO})`,
              maskRepeat: 'no-repeat',
              maskPosition: 'center left',
              maskSize: 'contain',
              WebkitMaskImage: `url(${LANDSCAPE_LOGO})`,
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center left',
              WebkitMaskSize: 'contain',
            }}
          />
          {agencyLogo && (
            <>
              <div className="h-5 w-px bg-border" />
              <img
                src={agencyLogo}
                alt={agencyName || 'Agency'}
                className="h-7 w-7 rounded-md object-cover"
              />
            </>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Log out
        </button>
      </div>

      {/* Hero section */}
      <div className="flex flex-col items-center justify-center text-center px-8 py-20 min-h-[calc(100vh-65px)]">
        <div className="max-w-lg space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight">
              Your trial has ended.
              <br />
              Your growth doesn't have to.
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              {agencyName
                ? `${agencyName} put in the work and built something worth keeping.`
                : 'You put in the work and built something worth keeping.'}{' '}
              Choose a plan and pick up right where you left off.
            </p>
          </div>

          {/* Usage stats */}
          {(clientCount > 0 || postCount > 0) && (
            <div className="flex items-center justify-center gap-8 py-2">
              {clientCount > 0 && (
                <div className="text-center">
                  <p className="text-3xl font-semibold tracking-tight">{clientCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {clientCount === 1 ? 'client' : 'clients'} managed
                  </p>
                </div>
              )}
              {clientCount > 0 && postCount > 0 && (
                <div className="h-8 w-px bg-border" />
              )}
              {postCount > 0 && (
                <div className="text-center">
                  <p className="text-3xl font-semibold tracking-tight">{postCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {postCount === 1 ? 'post' : 'posts'} created
                  </p>
                </div>
              )}
            </div>
          )}

          <Button onClick={scrollToPlans} className="gap-2 px-6">
            Choose a Plan
            <ChevronDown className="h-4 w-4" />
          </Button>

        </div>
      </div>

      {/* Plan cards */}
      <div ref={plansRef} className="px-8 py-16 max-w-275 mx-auto w-full space-y-8">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-medium tracking-tight">Pick the right plan for you</h2>
          <p className="text-sm text-muted-foreground">
            Reach out to the team and we'll get you set up right away.
          </p>
        </div>

        <div className="grid gap-6 lg:gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrentPlan={false}
              onContactTeam={handleContactTeam}
            />
          ))}
        </div>
      </div>

      <UpgradeRequestDialog
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        targetPlan={selectedPlan}
        currentPlanName="Trial"
      />
    </div>
  )
}
