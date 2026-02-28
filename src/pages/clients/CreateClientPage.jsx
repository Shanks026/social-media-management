import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient, updateClient, fetchClientById } from '@/api/clients'
import { supabase } from '@/lib/supabase'
import { useNavigate, useParams } from 'react-router-dom'

// UI Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Loader2, ChevronLeft, Camera, ImagePlus, AlertTriangle, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'

// Form & Validation
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'

// Custom Components
import PlatformSelector from './PlatformSelector'
import { INDUSTRY_OPTIONS } from '../../lib/industries'
import { useAuth } from '@/context/AuthContext'
import { useHeader } from '@/components/misc/header-context'

// --- SCHEMA ---
const clientSchema = z.object({
  name: z.string().min(2, 'Client name is required'),
  description: z.string().optional(),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  mobile_number: z
    .string()
    .min(1, 'Mobile number is required')
    .regex(/^\+91[6-9]\d{9}$/, 'Must be a valid +91 number'),
  status: z.enum(['ACTIVE', 'PAUSED']),
  tier: z.enum(['BASIC', 'PRO', 'VIP', 'INTERNAL']),
  logo_url: z.string().min(1, 'Client logo is required'),
  industry: z.string().min(1, 'Industry is required'),
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

export default function CreateClientPage({ customSubmit, onSuccess, onCancel, standalone = false, defaultValues = null }) {
  const { clientId } = useParams()
  const isEditMode = !!clientId
  const navigate = useNavigate()
  const { setHeader } = useHeader()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const fileInputRef = useRef(null)

  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [agencyBrandingMissing, setAgencyBrandingMissing] = useState(false)

  // Check if agency brand identity is configured (only relevant for external client creation)
  useEffect(() => {
    if (isEditMode || standalone) return
    async function checkAgencyBranding() {
      const { data } = await supabase
        .from('agency_subscriptions')
        .select('agency_name')
        .eq('user_id', user?.id)
        .maybeSingle()
      if (!data?.agency_name) setAgencyBrandingMissing(true)
    }
    checkAgencyBranding()
  }, [isEditMode, standalone, user?.id])

  const form = useForm({
    resolver: zodResolver(clientSchema),
    mode: 'onSubmit',
    defaultValues: defaultValues || {
      name: '',
      description: '',
      email: '',
      mobile_number: '+91',
      status: 'ACTIVE',
      tier: 'BASIC',
      logo_url: '',
      platforms: [],
      industry: '',
      social_links: {},
    },
  })

  const {
    formState: { errors },
    reset,
    control, // Destructure control from form
    setValue,
    getValues,
    watch,
  } = form
  const selectedPlatforms = form.watch('platforms')

  const isInternalContext = standalone || defaultValues?.tier === 'INTERNAL' || form.getValues('tier') === 'INTERNAL'

  const { data: existingClient, isLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => fetchClientById(clientId),
    enabled: isEditMode,
  })

  useEffect(() => {
    if (existingClient && isEditMode) {
      const platforms = existingClient.platforms || []
      const rawSocials = existingClient.social_links || {}

      const preparedSocials = { ...rawSocials }
      platforms.forEach((p) => {
        if (!preparedSocials[p]) preparedSocials[p] = { handle: '', url: '' }
      })

      // We use reset with the exact keys we want to populate
      reset({
        ...existingClient,
        social_links: preparedSocials,
      })

      setPreviewUrl(existingClient.logo_url)
    }
  }, [existingClient, isEditMode, reset])

  useEffect(() => {
    const currentSocials = form.getValues('social_links') || {}
    const nextSocials = { ...currentSocials }

    selectedPlatforms.forEach((p) => {
      if (!nextSocials[p]) nextSocials[p] = { handle: '', url: '' }
    })

    Object.keys(nextSocials).forEach((key) => {
      if (!selectedPlatforms.includes(key)) delete nextSocials[key]
    })

    form.setValue('social_links', nextSocials)
  }, [selectedPlatforms, form])

  useEffect(() => {
    if (standalone) return
    setHeader({
      title: isEditMode ? 'Edit Client' : 'Onboard New Client',
      breadcrumbs: [
        { label: 'Clients', href: '/clients' },
        ...(isEditMode
          ? [
              {
                label: existingClient?.name || 'Loading...',
                href: `/clients/${clientId}`,
              },
            ]
          : []),
        { label: isEditMode ? 'Edit' : 'Onboard New Client' },
      ],
      actions: null,
    })
  }, [setHeader, isEditMode, existingClient, clientId])

  const mutation = useMutation({
    mutationFn: (cleanValues) => {
      if (customSubmit) return customSubmit(cleanValues)
      return isEditMode
        ? updateClient(clientId, cleanValues) // Uses clientId from useParams
        : createClient({ ...cleanValues, user_id: user?.id })
    },
    onSuccess: (data) => {
      if (onSuccess) {
        onSuccess(data)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      if (clientId)
        queryClient.invalidateQueries({ queryKey: ['client', clientId] })
      toast.success(isEditMode ? 'Client updated' : 'Client onboarded')
      navigate(isEditMode ? `/clients/${clientId}` : '/clients')
    },
    onError: (error) => {
      console.error('Update Error:', error)
      toast.error('Update failed. Check console for details.')
    },
  })

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)
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

      form.setValue('logo_url', publicUrl, {
        shouldValidate: true,
        shouldDirty: true,
      })
      setPreviewUrl(publicUrl)
      toast.success('Logo uploaded!')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload logo')
    } finally {
      setIsUploading(false)
    }
  }

  const removeLogo = (e) => {
    e.stopPropagation()
    form.setValue('logo_url', '', { shouldValidate: true, shouldDirty: true })
    setPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const onFormSubmit = (values) => {
    // Destructure to remove system fields that shouldn't be updated
    const { id, created_at, user_id, is_internal, ...cleanValues } = values

    // Send only the clean values to the mutation
    mutation.mutate(cleanValues)
  }

  if (isEditMode && isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const onFormError = () => {
    toast.error('Please fix the errors below to continue.')
  }

  return (
    <div className="min-h-screen bg-background">
      <form onSubmit={form.handleSubmit(onFormSubmit, onFormError)}>
        <div className="mx-auto max-w-4xl px-6 py-10 space-y-14 pb-32">
          {/* --- TOP NAVIGATION & TITLE --- */}
          <div className="space-y-6">
            <div className="space-y-1">
              <h1 className="text-3xl font-normal tracking-tight">
                {standalone
                  ? 'Make it yours'
                  : isEditMode
                    ? `Edit ${existingClient?.name}`
                    : 'Onboard New Client'}
              </h1>
              <p className="text-muted-foreground">
                {standalone
                  ? 'Setup branding, socials, and contact information for your workspace.'
                  : isEditMode
                    ? 'Update workspace settings and contact info.'
                    : 'Setup branding, socials, and contact information.'}
              </p>
            </div>
          </div>

          {/* Agency branding soft prompt — shown only for new external client creation */}
          {agencyBrandingMissing && !isEditMode && !standalone && (
            <div className="flex items-start gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 text-sm">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
              <div className="flex-1 space-y-0.5">
                <p className="font-semibold text-foreground">Your agency brand isn't set up yet</p>
                <p className="text-muted-foreground">
                  The welcome email sent to this client will display <strong>"Tercero"</strong> instead of your agency name.
                  Complete your brand identity first for a fully white-labeled experience.
                </p>
              </div>
              <Link
                to="/myorganization"
                className="shrink-0 flex items-center gap-1 text-xs font-semibold text-amber-500 hover:text-amber-400 transition-colors mt-0.5"
              >
                Set up <ArrowRight size={13} />
              </Link>
            </div>
          )}

          {/* SECTION: Branding */}
          <section className="space-y-8">
            <h2 className="text-2xl font-normal">Branding & Identity</h2>

            <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
              <div className="shrink-0">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'group relative flex size-32 cursor-pointer flex-col items-center justify-center rounded-full border-2 border-dashed transition-all hover:bg-muted/50',
                    previewUrl ? 'border-primary/40' : 'border-border',
                    errors.logo_url && 'border-destructive/40 bg-destructive/5',
                  )}
                >
                  {previewUrl ? (
                    <div className="relative size-full overflow-hidden rounded-full border-2 border-border bg-background shadow-sm">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="size-full object-cover transition-transform group-hover:scale-110"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                        <Camera className="size-6 text-white" />
                      </div>
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="absolute right-0 top-0 z-10 translate-x-[-10%] translate-y-[10%] rounded-full bg-destructive p-1.5 text-white shadow-lg"
                      >
                        <ImagePlus className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground transition-colors group-hover:text-foreground">
                      {isUploading ? (
                        <Loader2 className="size-5 animate-spin text-primary" />
                      ) : (
                        <ImagePlus className="size-5" />
                      )}
                      <span className="text-xs font-medium">Logo</span>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                </div>
                {errors.logo_url && (
                  <p className="text-xs font-medium text-destructive text-center mt-2">
                    Required
                  </p>
                )}
              </div>

              <div className="flex-1 w-full space-y-6">
                <div className="space-y-2">
                  <Label>
                    Client Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    {...form.register('name')}
                    placeholder="e.g. Acme Corp"
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>
                    Industry <span className="text-destructive">*</span>
                  </Label>
                  <Controller
                    name="industry"
                    control={control}
                    render={({ field }) => (
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        key={field.value} // Key ensures re-render on value change
                        disabled={isInternalContext}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select industry" />
                        </SelectTrigger>
                        <SelectContent>
                          {INDUSTRY_OPTIONS.map((opt) => {
                            if (!isInternalContext && opt.value === 'Internal') return null
                            return (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.industry && (
                    <p className="text-xs text-destructive">
                      {errors.industry.message}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Internal Status</Label>
                    <Controller
                      name="status"
                      control={control}
                      render={({ field }) => (
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ACTIVE">Active</SelectItem>
                            <SelectItem value="PAUSED">Paused</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {/* FIXED: Service Tier Select using Controller */}
                  <div className="space-y-2">
                    <Label>Service Tier</Label>
                    <Controller
                      name="tier"
                      control={control}
                      render={({ field }) => (
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          key={field.value}
                          disabled={isInternalContext}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BASIC">Basic</SelectItem>
                            <SelectItem value="PRO">Pro</SelectItem>
                            <SelectItem value="VIP">VIP</SelectItem>
                            {isInternalContext && (
                              <SelectItem value="INTERNAL">Internal</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION: Socials */}
          <section className="space-y-8">
            <h2 className="text-2xl font-normal">Social Platforms</h2>
            <div className="py-2">
              <Controller
                name="platforms"
                control={form.control}
                render={({ field }) => (
                  <PlatformSelector
                    selected={field.value || []}
                    onChange={field.onChange}
                    register={form.register}
                    errors={errors}
                    watch={watch}
                    setValue={form.setValue}
                  />
                )}
              />
              {errors.platforms && (
                <p className="text-xs font-medium text-destructive mt-4">
                  {errors.platforms.message}
                </p>
              )}
            </div>
          </section>

          {/* SECTION: Contact Details */}
          <section className="space-y-8">
            <h2 className="text-2xl font-normal">Contact & Communication</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>
                  Primary Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  {...form.register('email')}
                  placeholder="example@company.com"
                />
                {errors.email && (
                  <p className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>
                  Mobile Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  {...form.register('mobile_number')}
                  placeholder="+91 9876543210"
                />
                {errors.mobile_number && (
                  <p className="text-xs text-destructive">
                    {errors.mobile_number.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description / Notes</Label>
              <Textarea
                {...form.register('description')}
                placeholder="Key goals or internal notes for this client..."
                className="min-h-[120px] resize-none"
              />
            </div>
          </section>

          {/* --- BOTTOM ACTION BUTTONS --- */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-6">
            <Button
              variant="outline"
              type="button"
              size="lg"
              onClick={() => (onCancel ? onCancel() : navigate(-1))} // Go back
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={mutation.isPending || isUploading}
            >
              {mutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : standalone ? (
                'Complete Setup'
              ) : isEditMode ? (
                'Save Changes'
              ) : (
                'Create Client'
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
