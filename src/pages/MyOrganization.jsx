import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useHeader } from '@/components/misc/header-context'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'

// API & Components
import ClientProfileView from '@/pages/clients/ClientProfileView'
import { Button } from '@/components/ui/button'
import { AgencySetupModal } from '@/components/AgencySetupModal'
import { fetchInternalClient } from '@/api/clients'
import { activateInternalWorkspace, fetchAgencySettings } from '@/api/agency'

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

  const [isActivating, setIsActivating] = useState(false)
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false)
  const [setupMode, setSetupMode] = useState('full') // 'full' or 'branding'
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)

  const { data: internalClient, isLoading: isClientLoading } = useQuery({
    queryKey: ['internal-client', user?.id],
    queryFn: fetchInternalClient,
    enabled: !!user,
  })

  const { data: agencySettings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['agency-settings', user?.id],
    queryFn: fetchAgencySettings,
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
      await queryClient.invalidateQueries(['internal-client'])
      toast.success('Internal workspace activated.')
    } catch (err) {
      toast.error('Activation failed.')
    } finally {
      setIsActivating(false)
    }
  }

  if (isClientLoading || isSettingsLoading) return null

  if (internalClient) {
    return <ClientProfileView client={internalClient} />
  }

  return (
    <div className="h-full bg-background overflow-y-auto selection:bg-primary/10">
      <div className="px-8 pt-8 pb-20 space-y-8 max-w-[1400px] mx-auto">
        {/* PAGE HEADER */}
        <div className="space-y-1">
          <h1 className="text-3xl font-light tracking-tight text-foreground">
            Organization
          </h1>
          <p className="text-sm text-muted-foreground font-light">
            Provision and manage your internal agency operational workspace.
          </p>
        </div>

        {agencySettings ? (
          /* PATH B: Branding Exists, needs Workspace Activation */
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="rounded-2xl border border-border/50 bg-card/30 overflow-hidden">
              <div className="p-8 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-7 space-y-6">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/5 border border-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wider">
                      <Zap size={12} fill="currentColor" /> Ready to Deploy
                    </div>
                    <h2 className="text-3xl md:text-4xl font-light tracking-tight">
                      Initialize your{' '}
                      <span className="font-normal italic">Workspace.</span>
                    </h2>
                    <p className="text-muted-foreground text-sm font-light leading-relaxed max-w-xl">
                      Your agency identity is verified. Activate your internal
                      workspace to unlock a dedicated environment for your
                      brand's social strategy and approval workflows.
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
                    size="xl"
                    disabled={isActivating}
                    onClick={() => setIsConfirmModalOpen(true)}
                    className="w-full lg:w-fit px-10 h-14 rounded-full text-base font-medium shadow-lg shadow-primary/10 transition-all gap-3"
                  >
                    {isActivating ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <>
                        Create Workspace <ArrowRight size={18} />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* PATH C: Zero Data - Choice Architecture */
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-light tracking-tight">
                Get Started
              </h2>
              <p className="text-muted-foreground text-sm font-light">
                Choose how you want to initialize your organization profile.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* Option 1: Branding Only */}
              <ChoiceCard
                icon={<Palette className="size-6" />}
                title="Identity Branding"
                description="Set your agency name and logo. Perfect if you just want to white-label your reports and portal."
                onClick={() => handleOpenSetup('branding')}
              />

              {/* Option 2: Full Setup */}
              <ChoiceCard
                icon={<Rocket className="size-6 text-primary" />}
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
        <DialogContent className="sm:max-w-xl p-0 overflow-hidden border-none shadow-2xl bg-background rounded-[32px]">
          <div className="p-10 space-y-8">
            <DialogHeader className="text-left space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Sparkles size={28} />
              </div>
              <div className="space-y-1.5">
                <DialogTitle className="text-3xl font-semibold tracking-tight">
                  Activate Agency Hub
                </DialogTitle>
                <DialogDescription className="text-base font-light leading-relaxed text-muted-foreground">
                  Initialize a dedicated operational environment for{' '}
                  <span className="text-foreground font-medium">
                    {agencySettings?.agency_name}
                  </span>
                  .
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-6 py-2">
              <BenefitDetail
                icon={<Layout size={20} />}
                title="Workflow Management"
                desc="Access custom approval pipelines designed for your brand's strategy."
              />
              <BenefitDetail
                icon={<Zap size={20} />}
                title="Full Creative Suite"
                desc="Unlock insights and scheduling tools usually reserved for clients."
              />
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="ghost"
                className="flex-1 h-14 rounded-full text-muted-foreground"
                onClick={() => setIsConfirmModalOpen(false)}
              >
                Maybe Later
              </Button>
              <Button
                className="flex-1 h-14 rounded-full"
                onClick={handleOneClickActivation}
              >
                Activate Now
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {isSetupModalOpen && (
        <AgencySetupModal
          user={user}
          mode={setupMode}
          onClose={() => setIsSetupModalOpen(false)}
          onComplete={() => {
            setIsSetupModalOpen(false)
            queryClient.invalidateQueries(['internal-client'])
            queryClient.invalidateQueries(['agency-settings'])
          }}
        />
      )}
    </div>
  )
}

function ChoiceCard({ icon, title, description, onClick, highlight = false }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative p-8 rounded-[32px] border transition-all cursor-pointer flex flex-col items-center text-center space-y-4',
        highlight
          ? 'border-primary/20 bg-primary/[0.02] hover:bg-primary/[0.04] hover:border-primary/40'
          : 'border-border/60 bg-muted/5 hover:bg-muted/10 hover:border-border',
      )}
    >
      <div
        className={cn(
          'size-14 rounded-2xl flex items-center justify-center mb-2 transition-transform group-hover:scale-110 duration-500',
          highlight
            ? 'bg-primary/10 text-primary'
            : 'bg-background text-muted-foreground border border-border/50 shadow-sm',
        )}
      >
        {icon}
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-medium tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground font-light leading-relaxed line-clamp-3">
          {description}
        </p>
      </div>
      <div className="pt-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="link" className="text-xs h-auto p-0 gap-1">
          Select Path <ArrowRight size={14} />
        </Button>
      </div>
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
        <p className="text-[11px] text-muted-foreground font-light">{desc}</p>
      </div>
    </div>
  )
}

function BenefitDetail({ icon, title, desc }) {
  return (
    <div className="flex gap-4">
      <div className="mt-1 h-10 w-10 shrink-0 rounded-xl bg-secondary/50 flex items-center justify-center text-primary">
        {icon}
      </div>
      <div className="space-y-1 text-sm font-light">
        <h4 className="font-semibold text-foreground tracking-tight">
          {title}
        </h4>
        <p className="text-muted-foreground leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}
