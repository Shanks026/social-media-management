import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateClient } from '@/api/clients'
import { supabase } from '@/lib/supabase'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
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
import { Loader2, X, Check, Camera, ImagePlus, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'

// Import components
import PlatformSelector from './PlatformSelector'
import { INDUSTRY_OPTIONS } from '../../lib/industries'

// Same Schema as Create
const editClientSchema = z.object({
  name: z.string().min(2, 'Client name is required'),
  description: z.string().optional(),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  mobile_number: z
    .string()
    .min(1, 'Mobile number is required')
    .regex(
      /^\+91[6-9]\d{9}$/,
      'Mobile number must start with +91 and contain 10 digits',
    ),
  status: z.enum(['ACTIVE', 'PAUSED']),
  tier: z.enum(['BASIC', 'PRO', 'VIP']),
  logo_url: z
    .string({ required_error: 'Client logo is required' })
    .min(1, 'Client logo is required'),
  industry: z.string().min(1, 'Industry is required'),
  platforms: z.array(z.string()).min(1, 'Select at least one active platform'),
})

const STEPS = [
  { id: 1, title: 'Branding', fields: ['logo_url', 'name', 'status', 'tier'] },
  { id: 2, title: 'Business', fields: ['industry', 'platforms'] },
  {
    id: 3,
    title: 'Contact',
    fields: ['email', 'mobile_number', 'description'],
  },
]

export default function EditClient({ client, onClose }) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)

  const form = useForm({
    resolver: zodResolver(editClientSchema),
    mode: 'onSubmit',
    defaultValues: {
      name: '',
      description: '',
      email: '',
      mobile_number: '+91',
      status: 'ACTIVE',
      tier: 'BASIC',
      logo_url: '',
      platforms: [],
      industry: '',
    },
  })

  // Destructure state
  const { errors, isDirty } = form.formState

  // --- INITIALIZATION ---
  useEffect(() => {
    if (client) {
      form.reset({
        name: client.name ?? '',
        description: client.description ?? '',
        email: client.email ?? '',
        mobile_number: client.mobile_number ?? '+91',
        status: client.status ?? 'ACTIVE',
        tier: client.tier ?? 'BASIC',
        logo_url: client.logo_url ?? '',
        industry: client.industry ?? '',
        platforms: client.platforms ?? [],
      })
      setPreviewUrl(client.logo_url)
    }
  }, [client, form])

  const mutation = useMutation({
    mutationFn: updateClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['client', client?.id] })
      toast.success('Client updated successfully')
      onClose()
    },
    onError: () => {
      toast.error('Failed to update client')
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
      toast.success('Logo updated!')
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

  // --- NAVIGATION ---
  const handleNext = (e) => {
    e.preventDefault()
    setCurrentStep((prev) => prev + 1)
  }

  const handleBack = (e) => {
    e.preventDefault()
    setCurrentStep((prev) => prev - 1)
  }

  const onFormSubmit = (values) => {
    if (!client) return
    mutation.mutate({ id: client.id, ...values })
  }

  const onFormError = (errors) => {
    const firstErrorStep = STEPS.find((step) =>
      step.fields.some((field) => errors[field]),
    )
    if (firstErrorStep && firstErrorStep.id !== currentStep) {
      setCurrentStep(firstErrorStep.id)
      toast.error(`Please fix errors in ${firstErrorStep.title}`)
    } else {
      toast.error('Please fix the errors before saving')
    }
  }

  const stepHasError = (stepId) => {
    const stepFields = STEPS.find((s) => s.id === stepId)?.fields || []
    return stepFields.some((field) => errors[field])
  }

  return (
    <Dialog open={!!client} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
          <DialogDescription>
            Modify details for{' '}
            <span className="font-semibold text-primary">{client?.name}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Stepper Visuals */}
        <div className="flex items-center justify-between py-4 px-2">
          {STEPS.map((step) => {
            const isError = stepHasError(step.id)
            const isActive = currentStep === step.id

            return (
              <div key={step.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(step.id)} // Allow free jumping in Edit mode
                  className={cn(
                    'size-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2 cursor-pointer',
                    isError
                      ? 'bg-destructive border-destructive text-destructive-foreground'
                      : isActive
                        ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                        : 'border-muted text-muted-foreground hover:border-primary/50',
                  )}
                >
                  {isError ? (
                    <AlertCircle size={14} />
                  ) : step.id < currentStep ? (
                    <Check size={14} strokeWidth={3} />
                  ) : (
                    step.id
                  )}
                </button>
                <span
                  className={cn(
                    'text-xs font-semibold hidden sm:inline cursor-pointer',
                    isError
                      ? 'text-destructive'
                      : isActive
                        ? 'text-foreground'
                        : 'text-muted-foreground',
                  )}
                  onClick={() => setCurrentStep(step.id)}
                >
                  {step.title}
                </span>
                {step.id < 3 && (
                  <div className="w-8 md:w-16 h-px bg-muted mx-1" />
                )}
              </div>
            )
          })}
        </div>

        <form
          onSubmit={form.handleSubmit(onFormSubmit, onFormError)}
          className="space-y-6"
        >
          <div className="min-h-[320px]">
            {/* --- STEP 1: BRANDING --- */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex flex-col items-center justify-center space-y-4 py-2">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      'group relative flex size-32 cursor-pointer flex-col items-center justify-center rounded-full border-2 border-dashed transition-all hover:bg-muted/50',
                      previewUrl
                        ? 'border-primary/20'
                        : 'border-muted-foreground/25',
                      errors.logo_url &&
                        'border-destructive/50 bg-destructive/5',
                    )}
                  >
                    {previewUrl ? (
                      <div className="relative size-full overflow-hidden rounded-full border-4 border-background shadow-md">
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="size-full object-cover transition-transform group-hover:scale-110"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <Camera className="size-6 text-white" />
                        </div>
                        <button
                          type="button"
                          onClick={removeLogo}
                          className="absolute right-0 top-0 translate-x-[-25%] translate-y-[25%] rounded-full bg-destructive p-1.5 text-white shadow-lg hover:scale-110"
                        >
                          <X size={12} strokeWidth={3} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground transition-colors group-hover:text-primary">
                        <div className="rounded-full bg-muted p-3 group-hover:bg-primary/10">
                          {isUploading ? (
                            <Loader2 className="size-6 animate-spin text-primary" />
                          ) : (
                            <ImagePlus className="size-6" />
                          )}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          Change Logo
                        </span>
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
                    <p className="text-[10px] font-medium text-destructive">
                      {errors.logo_url.message}
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">
                      Client Business Name{' '}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      {...form.register('name')}
                      placeholder="e.g. Acme Corp"
                    />
                    {errors.name && (
                      <p className="text-[10px] font-medium text-destructive">
                        {errors.name.message}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        Status <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={form.watch('status')}
                        onValueChange={(v) =>
                          form.setValue('status', v, { shouldDirty: true })
                        }
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="PAUSED">Paused</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        Service Tier <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={form.watch('tier')}
                        onValueChange={(v) =>
                          form.setValue('tier', v, { shouldDirty: true })
                        }
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BASIC">Basic Plan</SelectItem>
                          <SelectItem value="PRO">Pro Plan</SelectItem>
                          <SelectItem value="VIP">VIP Access</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- STEP 2: BUSINESS --- */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Industry Vertical{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.watch('industry')}
                    onValueChange={(v) =>
                      form.setValue('industry', v, { shouldDirty: true })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.industry && (
                    <p className="text-[10px] text-destructive">
                      {errors.industry.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Active Platforms <span className="text-destructive">*</span>
                  </Label>
                  <Controller
                    name="platforms"
                    control={form.control}
                    render={({ field }) => (
                      <PlatformSelector
                        selected={field.value || []}
                        onChange={(val) => {
                          field.onChange(val)
                          form.setValue('platforms', val, { shouldDirty: true })
                        }}
                      />
                    )}
                  />
                  {errors.platforms && (
                    <p className="text-[10px] text-destructive">
                      {errors.platforms.message}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* --- STEP 3: CONTACT --- */}
            {currentStep === 3 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">
                      Primary Contact Email{' '}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      {...form.register('email')}
                      placeholder="client@company.com"
                    />
                    {errors.email && (
                      <p className="text-[10px] text-destructive">
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">
                      Direct Mobile Number{' '}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      {...form.register('mobile_number')}
                      placeholder="+91"
                    />
                    {errors.mobile_number && (
                      <p className="text-[10px] text-destructive">
                        {errors.mobile_number.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    Internal Notes
                  </Label>
                  <Textarea
                    {...form.register('description')}
                    placeholder="Briefly describe client goals..."
                    className="min-h-[140px] resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>

            <div className="flex gap-2">
              {currentStep > 1 && (
                <Button type="button" variant="outline" onClick={handleBack}>
                  Back
                </Button>
              )}

              {currentStep < 3 ? (
                <Button type="button" onClick={handleNext}>
                  Next Step
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={mutation.isPending || isUploading || !isDirty}
                  className="min-w-[140px]"
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
