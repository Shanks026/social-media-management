import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useHeader } from '@/components/misc/header-context'
import { useAuth } from '@/context/AuthContext'
import { usePermissions } from '@/api/usePermissions'
import { useOutletContext } from 'react-router-dom'
import { toast } from 'sonner'

// API & Components
import ClientProfileView from '@/pages/clients/ClientProfileView'
import { Button } from '@/components/ui/button'
import OnboardingPage from '@/pages/onboarding/Onboarding'
import { fetchInternalClient } from '@/api/clients'
import { activateInternalWorkspace } from '@/api/agency'

// UI Components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

// Icons
import {
  ArrowRight,
  Plus,
  Sparkles,
  Loader2,
  CheckCircle2,
  Building2,
  Zap,
  HardDrive,
  Layout,
} from 'lucide-react'

export default function MyOrganization() {
  const { setHeader } = useHeader()
  const { user } = useAuth()
  const { canEditWorkspace } = usePermissions()
  const queryClient = useQueryClient()
  const { agencySettings, refreshAgency } = useOutletContext() || {}

  const [isActivating, setIsActivating] = useState(false)
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)

  const {
    data: internalClient,
    isLoading: isClientLoading,
    isRefetching: isClientRefetching,
  } = useQuery({
    queryKey: ['internal-client', user?.id],
    queryFn: fetchInternalClient,
    enabled: !!user,
  })

  useEffect(() => {
    setHeader({
      title: 'Workspace',
      breadcrumbs: [{ label: 'My Organization' }, { label: 'Workspace' }],
    })
  }, [setHeader])

  // Editing agency identity is owner-only — admins are view-only on workspace
  // settings (.claude/features/03-rbac-team-roles.md).
  const handleOpenSetup = () => {
    if (!canEditWorkspace) return
    setIsSetupModalOpen(true)
  }

  const handleOneClickActivation = async () => {
    setIsConfirmModalOpen(false)
    setIsActivating(true)
    try {
      await activateInternalWorkspace(agencySettings)
      await queryClient.invalidateQueries({ queryKey: ['internal-client'] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      if (refreshAgency) await refreshAgency()
      toast.success('Internal workspace activated.')
    } catch (err) {
      toast.error('Activation failed.')
    } finally {
      setIsActivating(false)
    }
  }

  if (isClientLoading || isClientRefetching || isActivating) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  if (internalClient) {
    return <ClientProfileView client={internalClient} />
  }

  if (isSetupModalOpen) {
    return (
      <div className="h-full bg-background overflow-y-auto selection:bg-primary/10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <OnboardingPage
          user={user}
          includeActivation={false}
          onComplete={async () => {
            // Wait for AppShell to fetch and update AppSidebar
            if (refreshAgency) await refreshAgency()
            await queryClient.invalidateQueries({
              queryKey: ['internal-client'],
            })
            queryClient.invalidateQueries({ queryKey: ['clients'] })
            // Then close to reveal the newly branded workspace
            setIsSetupModalOpen(false)
          }}
          onSkip={() => setIsSetupModalOpen(false)}
        />
      </div>
    )
  }

  return (
    <div className="h-full bg-background overflow-y-auto selection:bg-primary/10">
      <div className="px-8 pt-8 pb-20 space-y-8 max-w-[1400px] mx-auto">
        {/* PAGE HEADER */}
        <div className="space-y-1">
          <h1 className="text-3xl font-normal tracking-tight text-foreground bricolage">
            Workspace
          </h1>
          <p className="text-sm text-muted-foreground font-normal">
            Provision and manage your internal agency operational workspace.
          </p>
        </div>

        {agencySettings?.agency_name ? (
          /* PATH B: Brand identity done — offer one-click workspace activation */
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="rounded-2xl border border-border/50 bg-card/30 overflow-hidden">
              <div className="p-8 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-7 space-y-6">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-400 text-[10px] font-semibold uppercase tracking-wider">
                      <Zap size={12} fill="currentColor" /> Ready to Deploy
                    </div>
                    <h2 className="text-3xl font-normal tracking-tight bricolage">
                      Initialize your{' '}
                      <span className="font-normal italic">Workspace.</span>
                    </h2>
                    <p className="text-muted-foreground text-sm font-normal leading-relaxed max-w-xl">
                      Your agency identity is verified. Activate your
                      operational workspace to unlock a dedicated environment
                      for your brand's social strategy and creative workflows.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-x-10 gap-y-4 pt-2">
                    <CompactBenefit
                      icon={<CheckCircle2 size={16} />}
                      title="Subscription Exempt"
                      desc="No client slots used"
                    />
                    <CompactBenefit
                      icon={<HardDrive size={16} />}
                      title="Shared Storage"
                      desc="Unified media pool"
                    />
                  </div>
                </div>

                <div className="lg:col-span-5 flex flex-col items-center lg:items-end gap-4">
                  <Button
                    disabled={isActivating}
                    onClick={() => setIsConfirmModalOpen(true)}
                    className="w-full lg:w-fit gap-2"
                  >
                    {isActivating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        Create Workspace <ArrowRight size={14} />
                      </>
                    )}
                  </Button>
                  {canEditWorkspace && (
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                      onClick={handleOpenSetup}
                    >
                      Reset &amp; reconfigure →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* PATH C: Zero Data — single setup entry point */
          <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-1000">
            <div className="flex flex-col items-center text-center gap-6 rounded-2xl border border-border/60 bg-muted/10 px-8 py-14">
              <span className="text-5xl">🚀</span>
              <div className="space-y-2">
                <h2 className="text-3xl font-normal tracking-tight bricolage">
                  Set up your agency
                </h2>
                <p className="text-sm text-muted-foreground font-normal leading-relaxed max-w-md">
                  {canEditWorkspace
                    ? 'Four quick steps — your branding, contact details, invoice signatory and platforms. Your internal agency workspace gets provisioned at the same time.'
                    : 'The workspace owner needs to complete agency setup before this page has anything to show.'}
                </p>
              </div>
              {canEditWorkspace && (
                <Button onClick={handleOpenSetup} className="gap-2">
                  Get started <ArrowRight size={14} />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- CONFIRMATION MODAL --- */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              {/* <div className="h-9 w-9 rounded-lg bg-transparent flex items-center justify-center text-primary shrink-0"> */}
              <Sparkles size={16} />
              {/* </div> */}
              <DialogTitle className="text-2xl font-semibold">
                Activate Agency Hub
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Initialize a dedicated operational environment for{' '}
              <span className="text-foreground font-medium">
                {agencySettings?.agency_name}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 py-2">
            <BenefitDetail
              icon={<Layout size={16} />}
              title="Workflow Management"
              desc="Access custom approval pipelines designed for your brand's strategy."
            />
            <BenefitDetail
              icon={<Zap size={16} />}
              title="Full Creative Suite"
              desc="Unlock insights and scheduling tools usually reserved for clients."
            />
          </div>

          <DialogFooter className="gap-2 pt-1">
            <Button
              variant="ghost"
              onClick={() => setIsConfirmModalOpen(false)}
            >
              Maybe Later
            </Button>
            <Button onClick={handleOneClickActivation}>Activate Now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CompactBenefit({ icon, title, desc }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-primary opacity-70">{icon}</div>
      <div className="space-y-0.5">
        <h4 className="text-[12px] font-semibold text-foreground uppercase tracking-wider leading-none">
          {title}
        </h4>
        <p className="text-[11px] text-muted-foreground font-normal">{desc}</p>
      </div>
    </div>
  )
}

function BenefitDetail({ icon, title, desc }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}
