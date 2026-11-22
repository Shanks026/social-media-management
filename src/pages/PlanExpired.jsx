import { useState, useRef } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { ChevronDown, LogOut, RefreshCw } from 'lucide-react'

import { useAuth } from '@/context/AuthContext'
import { useSubscription } from '@/api/useSubscription'
import { useWorkspacePostCount } from '@/api/posts'
import { Button } from '@/components/ui/button'
import { plans } from '@/pages/billingAndUsage/planMeta'
import { PlanCard, UpgradeRequestDialog } from '@/pages/billingAndUsage/TertiarySubscriptionTab'
import { cn } from '@/lib/utils'

const APP_NAME = 'Tercero'
const LANDSCAPE_LOGO = '/TerceroLand.svg'

// What differs between a locked Trial and a locked paid subscription.
const VARIANTS = {
  trial: {
    isLocked: (sub) => sub?.is_trial_locked,
    planHeading: 'Pick the right plan for you',
    headingClass: 'bricolage',
  },
  subscription: {
    isLocked: (sub) => sub?.is_sub_locked,
    planHeading: 'Or upgrade to a higher plan',
    headingClass: null,
  },
}

function TrialHero({ sub, agencyName, onChoosePlan }) {
  const clientCount = sub?.client_count ?? 0
  const { data: postCount = 0 } = useWorkspacePostCount()

  return (
    <div className="max-w-lg space-y-6">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight bricolage">
          Your trial has ended.
          <br />
          Your growth doesn&apos;t have to.
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          {agencyName
            ? `${agencyName} put in the work and built something worth keeping.`
            : 'You put in the work and built something worth keeping.'}{' '}
          Choose a plan and pick up right where you left off.
        </p>
      </div>

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
          {clientCount > 0 && postCount > 0 && <div className="h-8 w-px bg-border" />}
          {postCount > 0 && (
            <div className="text-center">
              <p className="text-3xl font-semibold tracking-tight">{postCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {postCount === 1 ? 'deliverable' : 'deliverables'} created
              </p>
            </div>
          )}
        </div>
      )}

      <Button onClick={onChoosePlan} className="gap-2 px-6">
        Choose a Plan
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  )
}

function SubscriptionHero({ agencyName, planName, onRenew, onChoosePlan }) {
  return (
    <div className="max-w-lg space-y-6">
      <div className="space-y-3">
        <div className="text-5xl leading-none select-none mb-4">🔒</div>
        <h1 className="text-4xl font-semibold tracking-tight">
          Your {planName} subscription
          <br />
          has ended.
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          {agencyName ? `${agencyName}'s account is currently locked.` : 'Your account is currently locked.'}{' '}
          Renew your subscription or upgrade to a higher plan to restore full access.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button size="lg" onClick={onRenew} className="gap-2 px-6 w-full sm:w-auto">
          <RefreshCw className="h-4 w-4" />
          Renew {planName}
        </Button>
        <Button size="lg" variant="outline" onClick={onChoosePlan} className="gap-2 px-6 w-full sm:w-auto">
          Upgrade Plan
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

/**
 * The screen a locked workspace lands on: `variant="trial"` when its Trial has
 * run out, `variant="subscription"` when its paid plan has. Anyone whose
 * workspace isn't locked that way is sent to the dashboard.
 */
export default function PlanExpired({ variant }) {
  const config = VARIANTS[variant]
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { data: sub, isLoading } = useSubscription()
  const plansRef = useRef(null)

  const [renewDialogOpen, setRenewDialogOpen] = useState(false)
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)

  const isTrial = variant === 'trial'
  const agencyLogo = sub?.logo_url
  const agencyName = sub?.agency_name && sub.agency_name !== APP_NAME ? sub.agency_name : null
  const planName = isTrial
    ? 'Trial'
    : sub?.plan_name
      ? sub.plan_name.charAt(0).toUpperCase() + sub.plan_name.slice(1)
      : 'Current'

  const handleLogout = async () => {
    // The context's signOut clears auth state at once; the raw Supabase call
    // leaves the session set for a moment and bounces back (see NoWorkspaceAccess).
    await signOut()
    navigate('/login')
  }

  const scrollToPlans = () => plansRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const chooseUpgrade = (plan) => {
    setSelectedPlan(plan)
    setUpgradeDialogOpen(true)
  }

  if (isLoading) return null
  if (!config.isLocked(sub)) return <Navigate to="/dashboard" replace />

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
              <img src={agencyLogo} alt={agencyName || 'Agency'} className="h-7 w-7 rounded-md object-cover" />
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

      {/* Hero */}
      <div className="flex flex-col items-center justify-center text-center px-8 py-20 min-h-[calc(100vh-65px)]">
        {isTrial ? (
          <TrialHero sub={sub} agencyName={agencyName} onChoosePlan={scrollToPlans} />
        ) : (
          <SubscriptionHero
            agencyName={agencyName}
            planName={planName}
            onRenew={() => setRenewDialogOpen(true)}
            onChoosePlan={scrollToPlans}
          />
        )}
      </div>

      {/* Plan cards */}
      <div ref={plansRef} className="px-8 py-16 max-w-275 mx-auto w-full space-y-8">
        <div className="text-center space-y-1">
          <h2 className={cn('text-xl font-medium tracking-tight', config.headingClass)}>{config.planHeading}</h2>
          <p className="text-sm text-muted-foreground">
            Reach out to the team and we&apos;ll get you set up right away.
          </p>
        </div>

        <div className="grid gap-6 lg:gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrentPlan={!isTrial && plan.id === sub?.plan_name}
              onContactTeam={chooseUpgrade}
            />
          ))}
        </div>
      </div>

      {!isTrial && (
        <UpgradeRequestDialog
          open={renewDialogOpen}
          onOpenChange={setRenewDialogOpen}
          targetPlan={null}
          currentPlanName={planName}
          requestType="renewal"
        />
      )}
      <UpgradeRequestDialog
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        targetPlan={selectedPlan}
        currentPlanName={planName}
        {...(!isTrial && { requestType: 'upgrade' })}
      />
    </div>
  )
}
