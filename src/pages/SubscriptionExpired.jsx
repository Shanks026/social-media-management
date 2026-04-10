import { useState, useRef } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useSubscription } from '@/api/useSubscription'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { ChevronDown, LogOut, RefreshCw, ArrowRight } from 'lucide-react'
import {
  plans,
  PlanCard,
  UpgradeRequestDialog,
} from '@/pages/billingAndUsage/TertiarySubscriptionTab'

const LANDSCAPE_LOGO = '/TerceroLand.svg'
const APP_NAME = 'Tercero'

export default function SubscriptionExpired() {
  const navigate = useNavigate()
  const { data: sub, isLoading: subLoading } = useSubscription()
  const plansRef = useRef(null)

  const [renewDialogOpen, setRenewDialogOpen] = useState(false)
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)

  const agencyLogo = sub?.logo_url
  const agencyName = sub?.agency_name && sub.agency_name !== APP_NAME ? sub.agency_name : null
  const currentPlanName = sub?.plan_name
    ? sub.plan_name.charAt(0).toUpperCase() + sub.plan_name.slice(1)
    : 'Current'

  const handleUpgrade = (plan) => {
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
  if (!sub?.is_sub_locked) return <Navigate to="/dashboard" replace />

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
            <div className="text-5xl leading-none select-none mb-4">🔒</div>
            <h1 className="text-4xl font-semibold tracking-tight">
              Your {currentPlanName} subscription
              <br />
              has ended.
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              {agencyName
                ? `${agencyName}'s account is currently locked.`
                : 'Your account is currently locked.'}{' '}
              Renew your subscription or upgrade to a higher plan to restore full access.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={() => setRenewDialogOpen(true)}
              className="gap-2 px-6 w-full sm:w-auto"
            >
              <RefreshCw className="h-4 w-4" />
              Renew {currentPlanName}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={scrollToPlans}
              className="gap-2 px-6 w-full sm:w-auto"
            >
              Upgrade Plan
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Plan cards */}
      <div ref={plansRef} className="px-8 py-16 max-w-275 mx-auto w-full space-y-8">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-medium tracking-tight">Or upgrade to a higher plan</h2>
          <p className="text-sm text-muted-foreground">
            Reach out to the team and we'll get you set up right away.
          </p>
        </div>

        <div className="grid gap-6 lg:gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrentPlan={plan.id === sub?.plan_name}
              onContactTeam={handleUpgrade}
            />
          ))}
        </div>
      </div>

      {/* Renewal dialog */}
      <UpgradeRequestDialog
        open={renewDialogOpen}
        onOpenChange={setRenewDialogOpen}
        targetPlan={null}
        currentPlanName={currentPlanName}
        requestType="renewal"
      />

      {/* Upgrade dialog */}
      <UpgradeRequestDialog
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        targetPlan={selectedPlan}
        currentPlanName={currentPlanName}
        requestType="upgrade"
      />
    </div>
  )
}
