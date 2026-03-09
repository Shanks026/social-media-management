import { useState, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

// API
import { fetchInternalClient } from '@/api/clients'
import {
  activateInternalWorkspace,
  completeFullAgencySetup,
  setupBrandingOnly,
} from '@/api/agency'
import CreateClientPage from '@/pages/clients/CreateClientPage'

// UI
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
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
  Building2,
  Mail,
  CalendarDays,
  Trash2,
  Loader2,
  ArrowRight,
  Sparkles,
  Zap,
  CheckCircle2,
  HardDrive,
  Layout,
  Palette,
  Rocket,
  Camera,
  ImagePlus,
  Save,
  Globe,
  X,
  Phone,
  ShieldCheck,
  ExternalLink,
  Pencil,
} from 'lucide-react'

import { SUPPORTED_PLATFORMS } from '@/lib/platforms'
import HorizontalLogoCropDialog from '@/components/HorizontalLogoCropDialog'

export default function AgencySettings() {
  const { user } = useAuth()
  const { agencySettings, refreshAgency } = useOutletContext() || {}
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // Setup & activation state
  const [isActivating, setIsActivating] = useState(false)
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false)
  const [setupMode, setSetupMode] = useState('full')
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)

  // Agency logo editing
  const [agencyLogoUrl, setAgencyLogoUrl] = useState(null) // null = not editing
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isSavingAgency, setIsSavingAgency] = useState(false)
  const logoInputRef = useRef(null)

  // Horizontal logo editing
  const [horizontalLogoUrl, setHorizontalLogoUrl] = useState(null) // null = not editing (pending upload)
  const [savedHorizontalLogoUrl, setSavedHorizontalLogoUrl] = useState(
    () => agencySettings?.logo_horizontal_url || ''
  )
  const [isUploadingHorizontalLogo, setIsUploadingHorizontalLogo] = useState(false)
  const [isSavingHorizontalLogo, setIsSavingHorizontalLogo] = useState(false)
  const horizontalLogoInputRef = useRef(null)

  const [cropSrc, setCropSrc] = useState(null)        // local objectURL for the crop modal
  const [isCropOpen, setIsCropOpen] = useState(false)  // controls crop dialog visibility

  const { data: internalClient, isLoading: isClientLoading } = useQuery({
    queryKey: ['internal-client', user?.id],
    queryFn: fetchInternalClient,
    enabled: !!user,
  })

  // ── Handlers ──

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
    } catch {
      toast.error('Activation failed.')
    } finally {
      setIsActivating(false)
    }
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploadingLogo(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `branding/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('post-media')
        .upload(filePath, file)
      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('post-media').getPublicUrl(filePath)

      setAgencyLogoUrl(publicUrl)
      toast.success('Logo uploaded! Click Save to apply.')
    } catch (error) {
      console.error(error)
      toast.error('Failed to upload logo')
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const handleSaveAgencyLogo = async () => {
    if (agencyLogoUrl === null || !internalClient) return
    setIsSavingAgency(true)
    try {
      const dbUrl = agencyLogoUrl === '' ? null : agencyLogoUrl
      // Update client record
      const { error: clientErr } = await supabase
        .from('clients')
        .update({ logo_url: dbUrl })
        .eq('id', internalClient.id)

      if (clientErr) throw clientErr

      // Update agency_subscriptions branding
      const { error: subErr } = await supabase
        .from('agency_subscriptions')
        .update({
          logo_url: dbUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user?.id)

      if (subErr) throw subErr

      await queryClient.invalidateQueries({ queryKey: ['internal-client'] })
      if (refreshAgency) await refreshAgency()
      setAgencyLogoUrl(null)
      toast.success('Agency logo updated!')
    } catch {
      toast.error('Failed to save logo.')
    } finally {
      setIsSavingAgency(false)
    }
  }

  const handleHorizontalLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Revoke any previous objectURL to avoid memory leaks
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    const objectUrl = URL.createObjectURL(file)
    setCropSrc(objectUrl)
    setIsCropOpen(true)
    // Reset the input so the same file can be re-selected
    e.target.value = ''
  }

  const handleCropApplied = async (blob) => {
    setIsUploadingHorizontalLogo(true)
    try {
      const filePath = `branding/${Date.now()}.png`
      const { error: uploadError } = await supabase.storage
        .from('post-media')
        .upload(filePath, blob, { contentType: 'image/png' })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(filePath)
      setHorizontalLogoUrl(publicUrl)
      toast.success('Horizontal logo cropped! Click Save to apply.')
    } finally {
      setIsUploadingHorizontalLogo(false)
      // objectURL cleanup happens in handleCropDialogOpenChange when dialog closes,
      // so a failed upload doesn't wipe the image from the still-open dialog
    }
  }

  const handleCropDialogOpenChange = (open) => {
    setIsCropOpen(open)
    if (!open) {
      // Revoke the objectURL only once the dialog is fully closed
      if (cropSrc) URL.revokeObjectURL(cropSrc)
      setCropSrc(null)
    }
  }

  const handleSaveHorizontalLogo = async () => {
    if (horizontalLogoUrl === null) return
    setIsSavingHorizontalLogo(true)
    try {
      const dbUrl = horizontalLogoUrl === '' ? null : horizontalLogoUrl
      const { error: subErr } = await supabase
        .from('agency_subscriptions')
        .update({ logo_horizontal_url: dbUrl, updated_at: new Date().toISOString() })
        .eq('user_id', user?.id)
      if (subErr) throw subErr
      // Pin the display URL locally before nulling so the preview doesn't flicker
      // while agencySettings refetches in the background
      setSavedHorizontalLogoUrl(dbUrl || '')
      setHorizontalLogoUrl(null)
      if (refreshAgency) refreshAgency()
      toast.success('Horizontal logo updated!')
    } catch {
      toast.error('Failed to save horizontal logo.')
    } finally {
      setIsSavingHorizontalLogo(false)
    }
  }

  // ── Full-screen setup form ──
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
            if (refreshAgency) await refreshAgency()
            if (setupMode !== 'branding') {
              await queryClient.invalidateQueries({
                queryKey: ['internal-client'],
              })
              queryClient.invalidateQueries({ queryKey: ['clients'] })
            }
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

  // ── Loading ──
  if (isClientLoading || isActivating) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  // ── PATH A: Workspace exists — show agency profile ──
  if (internalClient) {
    const displayLogoUrl = agencyLogoUrl !== null ? agencyLogoUrl : internalClient.logo_url
    const displayHorizontalLogoUrl = horizontalLogoUrl !== null ? horizontalLogoUrl : savedHorizontalLogoUrl
    const platforms = internalClient.platforms || []

    return (
      <div className="max-w-4xl space-y-14 mx-auto">
        {/* Section: Branding & Identity */}
        <section className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-normal tracking-tight">
                Agency Profile
              </h2>
              <p className="text-sm text-muted-foreground font-light">
                Your internal agency identity and workspace details.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/clients/${internalClient.id}/edit`)}
              className="gap-2 w-fit shrink-0"
            >
              <Pencil size={14} />
              Edit Profile
            </Button>
          </div>

          {/* Row 1: Logo uploads + save actions */}
          <div className="flex items-start gap-6 flex-wrap">
            {/* Square logo */}
            <div
              onClick={() => logoInputRef.current?.click()}
              className={cn(
                'group relative flex size-28 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all hover:bg-muted/50 shrink-0',
                displayLogoUrl ? 'border-primary/40' : 'border-border',
              )}
            >
              {displayLogoUrl ? (
                <div className="relative size-full overflow-hidden rounded-2xl border-2 border-border bg-background shadow-sm">
                  <img
                    src={displayLogoUrl}
                    alt={internalClient.name}
                    className="size-full object-cover transition-transform group-hover:scale-110"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera className="size-6 text-white" />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground transition-colors group-hover:text-foreground">
                  {isUploadingLogo ? (
                    <Loader2 className="size-5 animate-spin text-primary" />
                  ) : (
                    <ImagePlus className="size-5" />
                  )}
                  <span className="text-xs font-medium">Logo</span>
                </div>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
                disabled={isUploadingLogo}
              />
            </div>

            {/* Horizontal logo */}
            <div className="shrink-0 space-y-1.5">
              <div
                onClick={() => horizontalLogoInputRef.current?.click()}
                className={cn(
                  'group relative cursor-pointer rounded-xl border-2 border-dashed transition-all hover:bg-muted/50',
                  displayHorizontalLogoUrl
                    ? 'border-primary/40 overflow-hidden'
                    : 'border-border flex h-28 w-52 items-center justify-center',
                )}
              >
                {displayHorizontalLogoUrl ? (
                  <>
                    <img
                      src={displayHorizontalLogoUrl}
                      alt="Horizontal logo"
                      className="block max-h-28 max-w-[280px] w-auto rounded-[10px]"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100 rounded-xl">
                      <Camera className="size-5 text-white" />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setHorizontalLogoUrl('')
                      }}
                      className="absolute top-1.5 right-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive"
                    >
                      <X size={11} />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground transition-colors group-hover:text-foreground">
                    {isUploadingHorizontalLogo ? (
                      <Loader2 className="size-5 animate-spin text-primary" />
                    ) : (
                      <ImagePlus className="size-5" />
                    )}
                    <span className="text-xs font-medium">Horizontal Logo</span>
                  </div>
                )}
                <input
                  ref={horizontalLogoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleHorizontalLogoUpload}
                  disabled={isUploadingHorizontalLogo}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                For invoices & documents.
              </p>
            </div>

            {/* Save actions — aligned left of the same row */}
            {(agencyLogoUrl !== null || horizontalLogoUrl !== null) && (
              <div className="flex flex-col gap-2 self-end pb-0.5">
                {agencyLogoUrl !== null && (
                  <Button size="sm" className="gap-2" onClick={handleSaveAgencyLogo} disabled={isSavingAgency}>
                    {isSavingAgency ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save Logo
                  </Button>
                )}
                {horizontalLogoUrl !== null && (
                  <Button size="sm" className="gap-2" onClick={handleSaveHorizontalLogo} disabled={isSavingHorizontalLogo}>
                    {isSavingHorizontalLogo ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {horizontalLogoUrl === '' ? 'Remove Horizontal Logo' : 'Save Horizontal Logo'}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Horizontal Logo Crop Dialog */}
          <HorizontalLogoCropDialog
            open={isCropOpen}
            onOpenChange={handleCropDialogOpenChange}
            imageSrc={cropSrc || ''}
            onCropComplete={handleCropApplied}
          />

          {/* Row 2: Details */}
          <div className="space-y-6">
            <div className="space-y-1">
              <h3 className="text-xl font-medium tracking-tight">
                {internalClient.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {internalClient.industry || 'Internal'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
              <InfoRow
                icon={<ShieldCheck size={16} />}
                label="Account Status"
                value={
                  <span className={internalClient.status === 'ACTIVE' ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                    {internalClient.status === 'ACTIVE' ? 'Active' : 'Paused'}
                  </span>
                }
              />
              <InfoRow
                icon={<ShieldCheck size={16} />}
                label="Account Tier"
                value={<span className="font-medium text-primary">{internalClient.tier || 'INTERNAL'}</span>}
              />
              <InfoRow
                icon={<Mail size={16} />}
                label="Agency Email"
                value={internalClient.email || '—'}
              />
              <InfoRow
                icon={<Phone size={16} />}
                label="Contact Number"
                value={internalClient.mobile_number || '—'}
              />
              <InfoRow
                icon={<Globe size={16} />}
                label="Official Website"
                value={
                  internalClient.website ? (
                    <a
                      href={
                        internalClient.website.startsWith('http')
                          ? internalClient.website
                          : `https://${internalClient.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary transition-colors flex items-center gap-1 group truncate"
                    >
                      <span className="truncate">{internalClient.website.replace(/(^\w+:|^)\/\//, '')}</span>
                      <ExternalLink className="size-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </a>
                  ) : (
                    '—'
                  )
                }
              />
              <InfoRow
                icon={<CalendarDays size={16} />}
                label="Created"
                value={
                  internalClient.created_at
                    ? format(new Date(internalClient.created_at), 'MMMM d, yyyy')
                    : '—'
                }
              />
            </div>
          </div>
        </section>

        <Separator className="opacity-50" />

        {/* Section: Platforms */}
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-normal tracking-tight">
              Platforms
            </h2>
            <p className="text-sm text-muted-foreground font-light">
              Social platforms linked to your agency workspace.
            </p>
          </div>

          {platforms.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {platforms.map((pId) => {
                const platform = SUPPORTED_PLATFORMS.find(
                  (p) => p.id === pId,
                )
                if (!platform) return null
                return (
                  <div
                    key={pId}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card/50"
                  >
                    <img
                      src={`/platformIcons/${platform.id === 'google_business' ? 'google_busines' : platform.id}.png`}
                      alt={platform.label}
                      className="size-4 object-contain"
                    />
                    <span className="text-sm font-medium">
                      {platform.label}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm text-muted-foreground py-4">
              <Globe size={16} />
              No platforms configured yet.
            </div>
          )}
        </section>

        <Separator className="opacity-50" />

        {/* Section: Danger Zone */}
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-medium text-destructive tracking-tight">
              Danger Zone
            </h2>
            <p className="text-sm text-muted-foreground font-light">
              Agency-level destructive actions.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">
                Delete Agency
              </p>
              <p className="text-xs text-muted-foreground">
                Remove agency workspace and all client data.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              disabled
              className="gap-2 opacity-50 cursor-not-allowed"
              title="Contact support to delete your agency"
            >
              <Trash2 size={14} />
              Contact Support
            </Button>
          </div>
        </section>
      </div>
    )
  }

  // ── PATH B: Brand done, no workspace ──
  if (agencySettings?.agency_name) {
    return (
      <>
        <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-700">
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
                    Your agency identity is verified. Activate your operational
                    workspace to unlock a dedicated environment for your
                    brand&apos;s social strategy.
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
                <button
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                  onClick={() => handleOpenSetup('full')}
                >
                  Reset &amp; reconfigure &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Activation Confirmation */}
        <ActivationDialog
          open={isConfirmModalOpen}
          onOpenChange={setIsConfirmModalOpen}
          agencyName={agencySettings?.agency_name}
          onActivate={handleOneClickActivation}
        />
      </>
    )
  }

  // ── PATH C: Nothing set up ──
  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-light tracking-tight">Get Started</h2>
        <p className="text-muted-foreground text-sm font-light">
          Choose how you want to initialize your agency profile.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <ChoiceCard
          icon={<Palette className="size-6" />}
          title="Identity Branding"
          description="Set your agency name and logo. Perfect if you just want to white-label your reports and portal."
          onClick={() => handleOpenSetup('branding')}
        />
        <ChoiceCard
          icon={<Rocket className="size-6 text-primary" />}
          title="Operational Workspace"
          description="Full identity setup plus a dedicated internal account for managing your own agency's social media."
          highlight
          onClick={() => handleOpenSetup('full')}
        />
      </div>
    </div>
  )
}

// ─── Sub-components ───

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-4">
      <div className="mt-0.5 h-9 w-9 shrink-0 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div className="space-y-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className="text-sm text-foreground truncate max-w-[200px] sm:max-w-xs">{value}</div>
      </div>
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
          ? 'border-primary/20 bg-primary/2 hover:bg-primary/4 hover:border-primary/40'
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

function ActivationDialog({ open, onOpenChange, agencyName, onActivate }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                  {agencyName}
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
              onClick={() => onOpenChange(false)}
            >
              Maybe Later
            </Button>
            <Button
              className="flex-1 h-14 rounded-full"
              onClick={onActivate}
            >
              Activate Now
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
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
