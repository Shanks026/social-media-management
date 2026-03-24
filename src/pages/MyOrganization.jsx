import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useHeader } from '@/components/misc/header-context'
import { useAuth } from '@/context/AuthContext'
import { useOutletContext } from 'react-router-dom'
import { toast } from 'sonner'

// API & Components
import ClientProfileView from '@/pages/clients/ClientProfileView'
import { Button } from '@/components/ui/button'
import CreateClientPage from '@/pages/clients/CreateClientPage'
import { fetchInternalClient } from '@/api/clients'
import {
  activateInternalWorkspace,
  fetchAgencySettings,
  completeFullAgencySetup,
  setupBrandingOnly,
} from '@/api/agency'

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
  Palette,
  Rocket,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function MyOrganization() {
  const { setHeader } = useHeader()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { agencySettings, refreshAgency } = useOutletContext() || {}

  const [isActivating, setIsActivating] = useState(false)
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false)
  const [setupMode, setSetupMode] = useState('full') // 'full' or 'branding'
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
      title: 'My Organization',
      breadcrumbs: [{ label: 'My Organization' }],
    })
  }, [setHeader])

  const handleOpenSetup = (mode) => {
    setSetupMode(mode)
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
        <CreateClientPage
          standalone
          customSubmit={async (data) => {
            if (setupMode === 'branding') {
              return await setupBrandingOnly(data)
            } else {
              return await completeFullAgencySetup(data)
            }
          }}
          onSuccess={async () => {
            // Wait for AppShell to fetch and update AppSidebar
            if (refreshAgency) await refreshAgency()

            if (setupMode !== 'branding') {
              await queryClient.invalidateQueries({
                queryKey: ['internal-client'],
              })
              queryClient.invalidateQueries({ queryKey: ['clients'] })
            }
            // Then close the modal to reveal the newly branded workspace/settings
            setIsSetupModalOpen(false)
          }}
          onCancel={() => setIsSetupModalOpen(false)}
          defaultValues={{
            name: '',
            description: '',
            email: user?.email || '',
            mobile_number: '+91',
            status: 'ACTIVE',
            tier: 'INTERNAL',
            logo_url: '',
            platforms: [],
            industry: 'Internal',
            social_links: {},
          }}
        />
      </div>
    )
  }

  return (
    <div className="h-full bg-background overflow-y-auto selection:bg-primary/10">
      <div className="px-8 pt-8 pb-20 space-y-8 max-w-[1400px] mx-auto">
        {/* PAGE HEADER */}
        <div className="space-y-1">
          <h1 className="text-3xl font-normal tracking-tight text-foreground">
            Organization
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
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/5 border border-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wider">
                      <Zap size={12} fill="currentColor" /> Ready to Deploy
                    </div>
                    <h2 className="text-3xl font-normal tracking-tight">
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
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                    onClick={() => handleOpenSetup('full')}
                  >
                    Reset &amp; reconfigure →
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* PATH C: Zero Data - Choice Architecture */
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-normal tracking-tight">
                Get Started
              </h2>
              <p className="text-muted-foreground text-sm font-normal">
                Choose how you want to initialize your organization profile.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* Option 1: Branding Only */}
              <ChoiceCard
                icon={<Palette className="size-4" />}
                title="Identity Branding"
                description="Set your agency name and logo. Perfect if you just want to white-label your reports and portal."
                onClick={() => handleOpenSetup('branding')}
              />

              {/* Option 2: Full Setup */}
              <ChoiceCard
                icon={<Rocket className="size-4" />}
                title="Operational Workspace"
                description="Full identity setup plus a dedicated internal account for managing your own agency's social media."
                highlight
                onClick={() => handleOpenSetup('full')}
              />
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

function ChoiceCard({ icon, title, description, onClick, highlight = false }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative p-5 rounded-xl border transition-all cursor-pointer flex flex-col gap-4 text-left',
        highlight
          ? 'border-primary/20 bg-primary/5 hover:bg-primary/8 hover:border-primary/40'
          : 'border-border/60 bg-muted/30 hover:bg-muted/50 hover:border-border',
      )}
    >
      <div
        className={cn(
          'size-9 rounded-lg flex items-center justify-center',
          highlight
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {icon}
      </div>
      <div className="space-y-1.5 flex-1">
        <h3 className="text-xl font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        Select{' '}
        <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
      </span>
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
