import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  completeAgencyOnboarding,
  markOnboardingComplete,
} from '@/api/agency'

import OnboardingStepper from './OnboardingStepper'
import IdentityStep from './steps/IdentityStep'
import ContactStep from './steps/ContactStep'
import SignatoryStep from './steps/SignatoryStep'
import PlatformsStep from './steps/PlatformsStep'
import InviteTeamStep from './steps/InviteTeamStep'

// Steps 0-3 write the agency record as one atomic submit.
const AGENCY_STEPS = [
  {
    key: 'identity',
    label: 'Identity',
    description: 'Name, logo & industry',
    Component: IdentityStep,
  },
  {
    key: 'contact',
    label: 'Contact',
    description: 'Email, address & website',
    Component: ContactStep,
  },
  {
    key: 'signatory',
    label: 'Signatory',
    description: 'For your invoices',
    Component: SignatoryStep,
  },
  {
    key: 'platforms',
    label: 'Platforms',
    description: 'Accounts you manage',
    Component: PlatformsStep,
  },
]

// Runs after the agency is saved, owning its own submit — so it can't fail the
// agency write. Onboarding covers the user's *own* company only; adding clients
// is real work, not setup, and belongs on /clients with the full form. The
// dashboard setup checklist carries the "add your first client" nudge.
const ACTIVATION_STEPS = [
  {
    key: 'invite_team',
    label: 'Team',
    description: 'Invite teammates',
    Component: InviteTeamStep,
  },
]

const AGENCY_STEP_COUNT = AGENCY_STEPS.length

// Fields validated when leaving each agency step — so an untouched signatory can
// never block the user on step 1.
const STEP_FIELDS = [
  ['agency_name', 'industry', 'logo_url', 'logo_horizontal_url'],
  ['email', 'mobile_number', 'website', 'location', 'address', 'description'],
  ['signatory_name', 'signatory_designation', 'signature_url'],
  ['platforms', 'social_links'],
]

const onboardingSchema = z.object({
  agency_name: z.string().min(2, 'Agency name is required'),
  industry: z.string().min(1, 'Industry is required'),
  // Logos are intentionally optional — branding degrades gracefully everywhere.
  logo_url: z.string().optional(),
  logo_horizontal_url: z.string().optional(),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  mobile_number: z.string().optional(),
  website: z.string().optional(),
  location: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
  signatory_name: z.string().optional(),
  signatory_designation: z.string().optional(),
  signature_url: z.string().optional(),
  platforms: z.array(z.string()).min(1, 'Select at least one platform'),
  social_links: z.object({}).catchall(
    z.object({
      handle: z.string().trim().min(1, 'Handle is required'),
      url: z
        .string()
        .trim()
        .url('Invalid URL')
        .or(z.string().length(0))
        .optional(),
    }),
  ),
})

/**
 * @param includeActivation  Append the invite-team and first-client steps.
 *   True for first-run onboarding; false when Settings reuses the wizard to
 *   reconfigure an existing agency (those users already have team and clients).
 */
export default function OnboardingPage({
  user,
  onComplete,
  onSkip,
  includeActivation = true,
}) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [agencySaved, setAgencySaved] = useState(false)
  const [isFinishing, setIsFinishing] = useState(false)
  const [inviteGenerated, setInviteGenerated] = useState(false)

  const steps = includeActivation
    ? [...AGENCY_STEPS, ...ACTIVATION_STEPS]
    : AGENCY_STEPS

  const form = useForm({
    resolver: zodResolver(onboardingSchema),
    mode: 'onSubmit',
    defaultValues: {
      agency_name: '',
      industry: '',
      logo_url: '',
      logo_horizontal_url: '',
      email: user?.email || '',
      mobile_number: '',
      website: '',
      location: '',
      address: '',
      description: '',
      signatory_name: user?.user_metadata?.full_name || '',
      signatory_designation: '',
      signature_url: '',
      platforms: [],
      social_links: {},
    },
  })

  const selectedPlatforms = form.watch('platforms')

  // Keep social_links keys in lockstep with the selected platforms, so the
  // schema never demands a handle for a deselected platform (and no stale
  // entries get submitted). Same behaviour as CreateClientPage.
  useEffect(() => {
    const current = form.getValues('social_links') || {}
    const next = { ...current }
    selectedPlatforms.forEach((p) => {
      if (!next[p]) next[p] = { handle: '', url: '' }
    })
    Object.keys(next).forEach((key) => {
      if (!selectedPlatforms.includes(key)) delete next[key]
    })
    form.setValue('social_links', next)
  }, [selectedPlatforms, form])

  const firstName = (() => {
    const fullName = user?.user_metadata?.full_name
    if (fullName) return fullName.split(' ')[0]
    const emailUser = user?.email?.split('@')[0]
    if (emailUser) return emailUser.charAt(0).toUpperCase() + emailUser.slice(1)
    return null
  })()

  // Which optional steps the user left undone — recorded on finish so the
  // dashboard checklist can offer them again.
  const collectSkippedSteps = () => {
    const v = form.getValues()
    const skipped = []
    if (!v.logo_url || !v.logo_horizontal_url) skipped.push('logos')
    if (!v.signatory_name && !v.signature_url) skipped.push('signatory')
    if (!inviteGenerated) skipped.push('invite_team')
    // Onboarding never asks for a client, so it's always outstanding here — the
    // dashboard checklist row is what surfaces it, and that row hides itself
    // once the workspace actually has a client.
    skipped.push('first_client')
    return skipped
  }

  const finish = async () => {
    // Only the real onboarding flow owns the onboarding columns — when Settings
    // reuses the wizard to reconfigure, it must not rewrite the skip list.
    if (includeActivation) {
      setIsFinishing(true)
      try {
        await markOnboardingComplete({ skippedSteps: collectSkippedSteps() })
        await queryClient.invalidateQueries({ queryKey: ['subscription'] })
      } catch (err) {
        // Non-blocking: the agency is already saved and the wizard won't
        // reappear, so never trap the user here over a checklist write.
        console.error('Failed to record onboarding progress:', err)
      } finally {
        setIsFinishing(false)
      }
    }

    if (onComplete) onComplete()
    else window.location.href = '/'
  }

  const mutation = useMutation({
    mutationFn: (values) => completeAgencyOnboarding(values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['internal-client'] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['subscription'] })

      if (includeActivation) {
        setAgencySaved(true)
        setStep(AGENCY_STEP_COUNT)
      } else {
        finish()
      }
    },
    onError: (error) => {
      console.error('Onboarding failed:', error)
      toast.error(error?.message || 'Setup failed. Please try again.')
    },
  })

  const isAgencyStep = step < AGENCY_STEP_COUNT
  const isLastAgencyStep = step === AGENCY_STEP_COUNT - 1
  const isFinalStep = step === steps.length - 1
  const { Component, key: stepKey } = steps[step]
  const busy = mutation.isPending || isFinishing

  // Activation steps report back so the skipped-step list reflects what the
  // user actually did, not just which screens they walked past.
  const ACTIVATION_PROPS = {
    invite_team: { onInviteGenerated: () => setInviteGenerated(true) },
  }

  const handleNext = async () => {
    const valid = await form.trigger(STEP_FIELDS[step])
    if (!valid) return
    setStep((s) => s + 1)
  }

  const submitAgency = form.handleSubmit(
    (values) => mutation.mutate(values),
    () => toast.error('Please fix the highlighted fields to continue.'),
  )

  const primaryLabel = (() => {
    if (isLastAgencyStep) return includeActivation ? 'Save & continue' : 'Finish setup'
    // Terminal step hands off to /welcome, not the dashboard — so the label
    // states what it does (ends setup) rather than naming a destination.
    if (isFinalStep) return 'Finish setup'
    return 'Continue'
  })()

  const handlePrimary = () => {
    if (isLastAgencyStep) submitAgency()
    else if (isFinalStep) finish()
    else handleNext()
  }

  const actions = (
    <div className="mt-14 flex items-center justify-between gap-3 border-t pt-6">
      <div>
        {isAgencyStep ? (
          step > 0 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={busy}
            >
              <ArrowLeft className="mr-1.5 size-4" /> Back
            </Button>
          ) : (
            onSkip && (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground"
                onClick={onSkip}
                disabled={busy}
              >
                Finish later
              </Button>
            )
          )
        ) : (
          // On activation steps, Back is only meaningful if there's an earlier
          // activation step to return to — the agency steps are sealed once
          // committed. With none, the primary action is the only one, and it
          // doubles as the skip (nothing on these steps is required).
          step > AGENCY_STEP_COUNT && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((s) => Math.max(AGENCY_STEP_COUNT, s - 1))}
              disabled={busy}
            >
              <ArrowLeft className="mr-1.5 size-4" /> Back
            </Button>
          )
        )}
      </div>

      <Button
        type={isAgencyStep ? 'submit' : 'button'}
        size="lg"
        disabled={busy}
        onClick={isAgencyStep ? undefined : handlePrimary}
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" /> Setting up...
          </>
        ) : (
          <>
            {primaryLabel}
            {!isLastAgencyStep && !isFinalStep && (
              <ArrowRight className="ml-1.5 size-4" />
            )}
          </>
        )}
      </Button>
    </div>
  )

  const body = (
    <div key={step} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      {isAgencyStep ? (
        <Component form={form} />
      ) : (
        <Component {...(ACTIVATION_PROPS[stepKey] || {})} />
      )}
    </div>
  )

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="mx-auto max-w-5xl px-6 py-12 pb-32">
        {/* Page header — greeting left, product mark right. Spans both columns
            so the greeting reads as the page title, not part of the left rail. */}
        <div className="mb-8 flex items-start justify-between gap-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
          <div className="space-y-2">
            {firstName && (
              <p className="text-sm font-medium tracking-wide text-muted-foreground">
                Hey, <span className="font-semibold text-foreground">{firstName}</span> 👋
              </p>
            )}
            <h1 className="text-3xl font-semibold tracking-tight bricolage">
              {agencySaved
                ? "You're set up. One last thing."
                : "Let's set up your agency."}
            </h1>
            <p className="text-sm text-muted-foreground">
              {agencySaved
                ? 'Optional — you can invite people later from the Team page.'
                : 'Everything here is editable later in Settings.'}
            </p>
          </div>

          <img
            src="/TerceroIcon.svg"
            alt="Tercero"
            className="mt-1 size-8 shrink-0 object-contain dark:invert"
          />
        </div>

        <Separator className="mb-10" />

        {/* Vertical stepper left, content right. The rail is navigation (past
            steps are clickable), so it sits on the same edge as AppSidebar.
            Row-reverse keeps the body first in the DOM — on mobile the stack
            still puts the progress indicator above the form. */}
        <div className="flex flex-col-reverse md:flex-row-reverse md:gap-14">
          {/* Step body + actions.
              Agency steps live inside a form so Enter submits; the activation
              steps carry their own forms, which cannot legally nest. */}
          <div className="min-w-0 flex-1">
            {isAgencyStep ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handlePrimary()
                }}
              >
                {body}
                {actions}
              </form>
            ) : (
              <div>
                {body}
                {actions}
              </div>
            )}
          </div>

          <aside className="shrink-0 md:w-52 lg:w-56 mb-10 md:mb-0">
            <div className="md:sticky md:top-12">
              {/* Full rail on desktop */}
              <div className="hidden md:block">
                <OnboardingStepper
                  steps={steps}
                  current={step}
                  onStepClick={setStep}
                  lockedBefore={agencySaved ? AGENCY_STEP_COUNT : 0}
                />
              </div>

              {/* Compact indicator on mobile — a six-item rail would push the
                  form off the first screen. */}
              <div className="md:hidden flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-primary text-xs font-semibold text-primary">
                  {step + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {steps[step].label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Step {step + 1} of {steps.length}
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
