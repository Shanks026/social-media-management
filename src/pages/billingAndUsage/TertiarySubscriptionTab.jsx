import { useRef, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Zap,
  Rocket,
  Atom,
  Check,
  X,
  ArrowRight,
  Info,
  Send,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { PlanOverview } from './PlanOverview'

// ── Plan data ──

const plans = [
  {
    id: 'ignite',
    name: 'Ignite',
    icon: Zap,
    bestFor: 'Freelancers & Solopreneurs',
    price: '1,999',
    accent: { text: 'text-amber-500' },
    features: {
      clients: { value: 'Up to 5 clients', included: true },
      workspace: { value: 'Internal Workspace included', included: true },
      storage: { value: '20 GB Storage limit', included: true },
      whitelabeling: { value: 'No whitelabeling', included: false },
      finance: { value: 'Basic ledger only', included: true },
      support: { value: 'Email support', included: true },
      costPerClient: { value: '₹400 per extra client', included: true },
    },
  },
  {
    id: 'velocity',
    name: 'Velocity',
    icon: Rocket,
    bestFor: 'Boutique Agencies',
    price: '5,999',
    popular: true,
    accent: { text: 'text-lime-500' },
    features: {
      clients: { value: 'Up to 15 clients', included: true },
      workspace: { value: 'Internal Workspace included', included: true },
      storage: { value: '100 GB Storage limit', included: true },
      whitelabeling: { value: 'Basic agency logo', included: true },
      finance: { value: 'Advanced invoicing & reports', included: true },
      support: { value: 'Priority chat support', included: true },
      costPerClient: { value: '₹400 per extra client', included: true },
    },
  },
  {
    id: 'quantum',
    name: 'Quantum',
    icon: Atom,
    bestFor: 'Scaling Firms & Enterprises',
    price: '12,999',
    accent: { text: 'text-violet-500' },
    features: {
      clients: { value: 'Up to 35 clients', included: true },
      workspace: { value: 'Internal Workspace included', included: true },
      storage: { value: '500 GB Storage limit', included: true },
      whitelabeling: { value: 'Full custom domain & email', included: true },
      finance: { value: 'Full CFO & profit analysis', included: true },
      support: { value: 'VIP Concierge setup', included: true },
      costPerClient: { value: '₹370 per extra client', included: true },
    },
  },
]

const featureKeys = [
  'clients',
  'workspace',
  'storage',
  'whitelabeling',
  'finance',
  'support',
  'costPerClient',
]

// ── Upgrade Request Dialog ──

const UpgradeRequestDialog = ({
  open,
  onOpenChange,
  targetPlan,
  currentPlanName,
}) => {
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!targetPlan) return null

  const prefilledMessage = `Dear Tertiary Admin,

I would like to request a plan upgrade for my agency account.

Current Plan: ${currentPlanName}
Requested Plan: ${targetPlan.name} (₹${targetPlan.price}/mo)

Kindly process this upgrade at your earliest convenience. I understand that the team will review and apply the changes to my account.

Thank you.`

  const handleSubmit = () => {
    setIsSubmitting(true)

    const payload = {
      requestType: 'plan_upgrade',
      currentPlan: currentPlanName,
      requestedPlan: targetPlan.name,
      requestedPlanPrice: targetPlan.price,
      message: prefilledMessage,
      additionalNotes: additionalNotes.trim() || null,
      timestamp: new Date().toISOString(),
    }

    // Log for now — will be replaced by a dedicated API later
    console.log('[Upgrade Request]', payload)

    setTimeout(() => {
      setIsSubmitting(false)
      setAdditionalNotes('')
      onOpenChange(false)
      toast.success('Your request has been received', {
        description:
          'Your plan will be upgraded shortly. Our team will reach out if any additional information is needed.',
      })
    }, 600)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <targetPlan.icon className={cn('size-5', targetPlan.accent.text)} />
            Upgrade to {targetPlan.name}
          </DialogTitle>
          <DialogDescription>
            Review the message below and submit your upgrade request. Our team
            will process it shortly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Pre-filled message — read only */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Upgrade Request
            </Label>
            <div className="rounded-lg border bg-muted/30 p-4 text-[13px] leading-relaxed text-muted-foreground whitespace-pre-line font-light">
              {prefilledMessage}
            </div>
          </div>

          {/* Additional notes — editable */}
          <div className="space-y-2">
            <Label
              htmlFor="additional-notes"
              className="text-xs text-muted-foreground"
            >
              Additional Notes{' '}
              <span className="text-muted-foreground/50">(optional)</span>
            </Label>
            <Textarea
              id="additional-notes"
              placeholder="Add any specific requirements or questions here..."
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              className="min-h-[80px] resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              'Sending...'
            ) : (
              <>
                <Send className="size-4" /> Submit Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Sub-components ──

const FeatureValue = ({ feature, accentClass, isPopular }) => {
  const textColor = isPopular ? 'text-background/80' : 'text-muted-foreground'
  const mutedTextColor = isPopular
    ? 'text-background/40'
    : 'text-muted-foreground/40'

  if (feature.included === false) {
    return (
      <div className="flex items-start gap-3">
        <X className={cn('size-4 shrink-0 mt-0.5', mutedTextColor)} />
        <span className={cn('text-[13px] font-light', mutedTextColor)}>
          {feature.value}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3">
      {/* Subtle touch of color on the checkmark */}
      <Check className={cn('size-4 shrink-0 mt-0.5', accentClass)} />
      <span className={cn('text-[13px] font-light', textColor)}>
        {feature.value}
      </span>
    </div>
  )
}

const PlanCard = ({ plan, isCurrentPlan, onContactTeam }) => {
  const isPopular = plan.popular

  // Invert colors for the "Popular" card to match the dark/light contrast inspiration
  const cardClasses = isPopular
    ? 'bg-foreground text-background border-transparent shadow-xl'
    : 'bg-card text-foreground border dark:border-none'

  const dividerClasses = isPopular ? 'bg-background/15' : 'bg-border/40'
  const descClasses = isPopular
    ? 'text-background/60'
    : 'text-muted-foreground/80'

  const buttonClasses = isPopular
    ? 'bg-background text-foreground hover:bg-background/90'
    : 'bg-foreground text-background hover:bg-foreground/90'

  return (
    <div
      className={cn(
        'relative rounded-2xl border p-8 lg:p-10 flex flex-col transition-transform duration-300 hover:-translate-y-1',
        cardClasses,
      )}
    >
      {/* Header with Recommended Tag */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-xl font-normal flex items-center gap-2">
          <plan.icon className={cn('size-4', plan.accent.text)} />
          {plan.name}
        </div>
        {isPopular && (
          <span className="bg-background text-foreground text-xs font-medium tracking-wider px-3 py-1 rounded-full shadow-sm">
            Recommended
          </span>
        )}
      </div>

      {/* Price */}
      <div className="mb-2 flex items-baseline gap-1">
        <span className="text-5xl font-light tracking-tight">
          ₹{plan.price}
        </span>
        <span className={cn('text-sm font-light', descClasses)}>/ mo</span>
      </div>

      <p className={cn('text-sm font-light mb-8', descClasses)}>
        For {plan.bestFor.toLowerCase()}
      </p>

      {/* Divider */}
      <div className={cn('w-full h-px mb-8', dividerClasses)} />

      {/* Features */}
      <div className="space-y-4 mb-10 flex-1">
        {featureKeys.map((key) => (
          <FeatureValue
            key={key}
            feature={plan.features[key]}
            accentClass={plan.accent.text}
            isPopular={isPopular}
          />
        ))}
      </div>

      {/* CTA Button */}
      <Button
        className={cn(
          'w-full h-12 rounded-lg font-medium text-[15px] transition-all gap-2',
          isCurrentPlan && 'opacity-50 cursor-not-allowed',
          buttonClasses,
        )}
        disabled={isCurrentPlan}
        onClick={() => onContactTeam?.(plan)}
      >
        {isCurrentPlan ? (
          'Current Plan'
        ) : (
          <>
            Contact Team <ArrowRight size={16} />
          </>
        )}
      </Button>
    </div>
  )
}

// ── Loading skeleton ──

const LoadingSkeleton = () => (
  <div className="space-y-8">
    <div className="h-36 bg-muted/30 animate-pulse rounded-2xl" />
    <div className="grid gap-6 lg:gap-8 md:grid-cols-3">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="h-[550px] bg-muted/30 animate-pulse rounded-2xl"
        />
      ))}
    </div>
  </div>
)

// ── Main Component ──

export const SubscriptionTab = ({ sub, isLoading }) => {
  const [searchParams, setSearchParams] = useSearchParams()

  // 1. Create a reference for the pricing section
  const plansSectionRef = useRef(null)

  // Upgrade request dialog state
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)

  // 2. Scroll function attached to the "Upgrade Plan" button
  const scrollToPlans = () => {
    plansSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  // Handle scroll parameter on mount
  useEffect(() => {
    if (isLoading || !sub) return

    if (searchParams.get('scroll') === 'true') {
      // Small timeout to ensure everything is rendered
      const timer = setTimeout(() => {
        scrollToPlans()
        
        // Remove scroll param
        setSearchParams((prev) => {
          const nextParams = new URLSearchParams(prev)
          nextParams.delete('scroll')
          return nextParams
        }, { replace: true })
      }, 300)

      return () => clearTimeout(timer)
    }
  }, [searchParams, setSearchParams, isLoading, sub])

  if (isLoading) return <LoadingSkeleton />
  if (!sub) return null

  const currentPlanName = sub.plan_name?.toLowerCase() || 'ignite'

  // Find the exact plan data object to pass to the overview card
  const currentPlan =
    plans.find((p) => p.name.toLowerCase() === currentPlanName) || plans[0]

  const handleContactTeam = (plan) => {
    setSelectedPlan(plan)
    setUpgradeDialogOpen(true)
  }
  return (
    <div className="space-y-12">
      <PlanOverview
        sub={sub}
        currentPlan={currentPlan}
        onUpgradeClick={scrollToPlans}
      />

      {/* 4. Attach the ref here so it knows where to scroll to */}
      <div className="space-y-8 scroll-mt-8" ref={plansSectionRef}>
        <div className="flex items-start gap-4 p-5 rounded-2xl border border-blue-100 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-900/20">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
              Subscription Management Notice
            </p>
            <p className="w-[70%] text-sm text-blue-800/80 dark:text-blue-400/80 leading-relaxed">
              Automated payment processing is currently unavailable. To upgrade
              your tier, please select
              <strong> "Contact Sales"</strong> on your preferred plan. This
              will notify our team, who will manually process your request and
              update your account access shortly.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-light tracking-tight">
            Choose your plan
          </h3>
          <p className="text-sm text-muted-foreground font-light">
            Simple, transparent pricing tailored to your scale.
          </p>
        </div>

        <div className="grid gap-6 lg:gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrentPlan={currentPlanName === plan.name.toLowerCase()}
              onContactTeam={handleContactTeam}
            />
          ))}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="pt-8 border-t border-border/30">
        <div className="mb-6">
          <h3 className="text-lg font-medium tracking-tight">
            Full Feature Comparison
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left px-4 py-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Feature
                </th>
                {plans.map((plan) => (
                  <th
                    key={plan.id}
                    className="text-center px-4 py-4 text-[11px] font-semibold uppercase tracking-wider"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <plan.icon className={cn('size-4', plan.accent.text)} />
                      {plan.name}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                {
                  label: 'Client Portals',
                  values: ['Up to 5', 'Up to 15', 'Up to 35'],
                },
                {
                  label: 'Internal Workspace',
                  values: [true, true, true],
                },
                {
                  label: 'Storage Limit',
                  values: ['20 GB', '100 GB', '500 GB'],
                },
                {
                  label: 'Whitelabeling',
                  values: [false, 'Basic', 'Full Custom'],
                },
                {
                  label: 'Finance Module',
                  values: ['Basic Ledger', 'Invoicing + Reports', 'Full CFO'],
                },
                {
                  label: 'Dedicated Support',
                  values: ['Email', 'Priority Chat', 'VIP Concierge'],
                },
                {
                  label: 'Cost Per Extra Client',
                  values: ['₹400 / mo', '₹400 / mo', '₹370 / mo'],
                },
              ].map((row, idx) => (
                <tr
                  key={row.label}
                  className="border-b border-border/20 transition-colors hover:bg-muted/10"
                >
                  <td className="px-4 py-4 text-[13px] font-medium text-muted-foreground">
                    {row.label}
                  </td>
                  {row.values.map((val, i) => (
                    <td
                      key={i}
                      className="text-center px-4 py-4 text-[13px] font-light"
                    >
                      {val === true ? (
                        <Check className="size-4 text-emerald-500 mx-auto" />
                      ) : val === false ? (
                        <X className="size-4 text-muted-foreground/30 mx-auto" />
                      ) : (
                        <span>{val}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upgrade Request Dialog */}
      <UpgradeRequestDialog
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        targetPlan={selectedPlan}
        currentPlanName={currentPlan.name}
      />
    </div>
  )
}
