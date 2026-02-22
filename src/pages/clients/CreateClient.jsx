import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/api/clients'
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
import { useAuth } from '@/context/AuthContext'

// --- SCHEMA ---
const createClientSchema = z.object({
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

// --- STEPS CONFIG ---
const STEPS = [
  {
    id: 1,
    title: 'Branding',
    subtitle: 'Logo, name & business details',
    fields: ['logo_url', 'name', 'status', 'tier', 'industry'],
  },
  {
    id: 2,
    title: 'Social Links',
    subtitle: 'Connect social media platforms',
    fields: ['platforms'],
  },
  {
    id: 3,
    title: 'Contact',
    subtitle: 'Email, mobile & notes',
    fields: ['email', 'mobile_number', 'description'],
  },
]

// --- COLORS ---
const AMBER = '#40513B'
const DARK_BTN = '#3D3D3D'
const GRAY_CIRCLE = '#D1D5DB'
const GRAY_TEXT = '#9CA3AF'
const GRAY_LINE = '#F3F4F6' // Even lighter connector line

export default function CreateClient({
  open,
  onOpenChange,
  customSubmit,
  onSuccess,
  title = 'Onboard a Client',
  defaultValues = null
}) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const fileInputRef = useRef(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)

  const form = useForm({
    resolver: zodResolver(createClientSchema),
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

  const { errors, isSubmitted } = form.formState
  const selectedPlatforms = form.watch('platforms')

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

  const mutation = useMutation({
    mutationFn: async (cleanValues) => {
      if (customSubmit) return await customSubmit(cleanValues)
      return await createClient({ ...cleanValues, user_id: user?.id })
    },
    onSuccess: (data) => {
      if (onSuccess) {
        onSuccess(data)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['subscription', user.id] })
      }
      toast.success('Client created successfully')
      handleCancel()
    },
    onError: (error) => {
      console.error('Mutation Error:', error)
      toast.error('Failed to create client')
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

  function resetForm() {
    form.reset()
    setPreviewUrl(null)
    setCurrentStep(1)
  }

  const onFormSubmit = (values) => {
    mutation.mutate({ ...values, user_id: user?.id })
  }

  const onFormError = (errors) => {
    const firstErrorStep = STEPS.find((step) =>
      step.fields.some((field) => errors[field]),
    )
    if (firstErrorStep && firstErrorStep.id !== currentStep) {
      setCurrentStep(firstErrorStep.id)
      toast.error(`Please fix errors in ${firstErrorStep.title} step`)
    } else {
      toast.error('Please fix the errors before proceeding')
    }
  }

  function handleCancel() {
    resetForm()
    onOpenChange(false)
  }

  const stepHasError = (stepId) => {
    const stepFields = STEPS.find((s) => s.id === stepId)?.fields || []
    return stepFields.some((field) => errors[field])
  }

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent
        className="sm:max-w-[1100px] w-[95vw] h-auto max-h-[850px] p-0 gap-0 overflow-hidden"
        showCloseButton={false}
      >
        {/* Screen-reader accessible header (visually hidden) */}
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Step {currentStep} of 3: {STEPS[currentStep - 1].title}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onFormSubmit, onFormError)}
          className="flex flex-col sm:flex-row h-full"
        >
          {/* ─── LEFT: Vertical Stepper Sidebar ─── */}
          <div className="w-full sm:w-[320px] shrink-0 border-b sm:border-b-0 sm:border-r border-neutral-100/50 p-10 flex flex-col">
            {/* Header */}
            <p className="text-sm font-medium text-muted-foreground mb-2">
              {title}
            </p>
            <h2 className="text-3xl font-medium tracking-tight mb-12 text-foreground">
              {STEPS[currentStep - 1].title}
            </h2>

            {/* Stepper with transition */}

            {/* Stepper */}
            <div className="flex flex-col flex-1">
              {STEPS.map((step, index) => {
                const isActive = currentStep === step.id
                const isCompleted = currentStep > step.id
                const isError = stepHasError(step.id)
                const isLast = index === STEPS.length - 1

                return (
                  <div key={step.id} className="flex gap-6 group">
                    {/* Circle + Line column */}
                    <div className="flex flex-col items-center">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(step.id)}
                        className="size-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all duration-300"
                        style={{
                          backgroundColor: isError
                            ? '#EF4444'
                            : isActive || isCompleted
                              ? AMBER
                              : '#F3F4F6',
                          color:
                            isActive || isCompleted || isError
                              ? '#FFFFFF'
                              : '#9CA3AF',
                        }}
                      >
                        {isError ? (
                          <AlertCircle size={18} />
                        ) : isCompleted ? (
                          <Check size={18} strokeWidth={3} />
                        ) : (
                          step.id
                        )}
                      </button>
                      {/* Connector line */}
                      {!isLast && (
                        <div
                          className="w-[2px] flex-1 min-h-[50px] my-1 transition-colors duration-300"
                          style={{
                            backgroundColor: isCompleted ? AMBER : GRAY_LINE,
                          }}
                        />
                      )}
                    </div>

                    {/* Label column */}
                    <div className="pt-1 pb-8 overflow-hidden">
                      <p
                        className={cn(
                          'text-base font-medium leading-tight transition-colors duration-300',
                          isError && 'text-destructive',
                        )}
                        style={{
                          color: isError
                            ? undefined
                            : isActive
                              ? 'text-foreground'
                              : 'text-muted-foreground',
                        }}
                      >
                        {step.title}
                      </p>
                      <p className="text-sm mt-1 pr-4 leading-tight text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                        {step.subtitle}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ─── RIGHT: Form Content ─── */}
          <div className="flex-1 flex flex-col bg-white">
            <div className="flex-1 px-6 py-12 overflow-hidden">
              <div
                className="grid transition-[grid-template-rows] duration-500 ease-in-out h-full overflow-y-auto"
                style={{ gridTemplateRows: '1fr' }}
              >
                <div className="min-h-0">
                  {/* ── Step 1: Branding ── */}
                  {currentStep === 1 && (
                    <div className="max-w-[600px] mx-auto space-y-6 animate-in fade-in duration-300">
                      {/* Logo upload */}
                      <div className="flex justify-center py-4">
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className={cn(
                            'group relative flex size-40 cursor-pointer flex-col items-center justify-center rounded-full border-2 border-dashed transition-all hover:bg-neutral-50',
                            previewUrl
                              ? 'border-primary/20'
                              : 'border-neutral-200',
                            errors.logo_url &&
                              'border-destructive/40 bg-destructive/5',
                          )}
                        >
                          {previewUrl ? (
                            <div className="relative size-full overflow-hidden rounded-full border-4 border-white">
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
                                className="absolute right-0 top-0 z-10 translate-x-[-15%] translate-y-[15%] rounded-full bg-destructive p-1.5 text-white shadow-lg hover:scale-110 active:scale-95"
                              >
                                <X size={12} strokeWidth={3} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-neutral-400 transition-colors group-hover:text-primary">
                              <div className="rounded-full bg-neutral-100 p-3 group-hover:bg-primary/10 transition-colors">
                                {isUploading ? (
                                  <Loader2 className="size-6 animate-spin text-primary" />
                                ) : (
                                  <ImagePlus className="size-6" />
                                )}
                              </div>
                              <span className="text-sm me-2 font-medium">
                                Upload Logo
                                <span className="text-destructive">*</span>
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
                      </div>
                      {errors.logo_url && (
                        <p className="text-sm font-semibold text-destructive text-center -mt-6">
                          {errors.logo_url.message}
                        </p>
                      )}

                      {/* Client Name */}
                      <div className="space-y-2.5">
                        <Label>
                          Client Name{' '}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          {...form.register('name')}
                          placeholder="e.g. Acme Corp"
                          className="h-9"
                        />
                        {errors.name && (
                          <p className="text-sm font-semibold text-destructive">
                            {errors.name.message}
                          </p>
                        )}
                      </div>

                      {/* Status + Service Tier */}
                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-2.5">
                          <Label>
                            Status <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={form.watch('status')}
                            onValueChange={(v) => form.setValue('status', v)}
                          >
                            <SelectTrigger className="w-full h-9 border-neutral-200">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ACTIVE">Active</SelectItem>
                              <SelectItem value="PAUSED">Paused</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2.5">
                          <Label>
                            Service Tier{' '}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={form.watch('tier')}
                            onValueChange={(v) => form.setValue('tier', v)}
                          >
                            <SelectTrigger className="w-full h-9 border-neutral-200">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="BASIC">Basic</SelectItem>
                              <SelectItem value="PRO">Pro</SelectItem>
                              <SelectItem value="VIP">VIP</SelectItem>
                              <SelectItem value="INTERNAL">Internal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Industry */}
                      <div className="space-y-2.5">
                        <Label>
                          Industry <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={form.watch('industry')}
                          onValueChange={(v) => form.setValue('industry', v)}
                        >
                          <SelectTrigger className="w-full h-9">
                            <SelectValue placeholder="Select industry" />
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
                          <p className="text-sm font-semibold text-destructive">
                            {errors.industry.message}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Step 2: Social Links ── */}
                  {currentStep === 2 && (
                    <div className="h-full animate-in fade-in duration-300 overflow-hidden">
                      <div className="overflow-x-hidden p-1">
                        <Controller
                          name="platforms"
                          control={form.control}
                          render={({ field }) => (
                            <PlatformSelector
                              selected={field.value || []}
                              onChange={field.onChange}
                              register={form.register}
                              errors={errors}
                            />
                          )}
                        />
                        {errors.platforms && (
                          <p className="text-sm font-semibold text-destructive mt-4">
                            {errors.platforms.message}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Step 3: Contact ── */}
                  {currentStep === 3 && (
                    <div className="max-w-[600px] mx-auto space-y-6 animate-in fade-in duration-300">
                      <div className="space-y-2.5">
                        <Label>
                          Email <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          {...form.register('email')}
                          placeholder="example@company.com"
                          className="h-9"
                        />
                        {errors.email && (
                          <p className="text-sm font-semibold text-destructive">
                            {errors.email.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2.5">
                        <Label>
                          Mobile <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          {...form.register('mobile_number')}
                          placeholder="+91 9876543210"
                          className="h-9"
                        />
                        {errors.mobile_number && (
                          <p className="text-sm font-semibold text-destructive">
                            {errors.mobile_number.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2.5">
                        <Label>Description</Label>
                        <Textarea
                          {...form.register('description')}
                          placeholder="Brief notes about the client relationship or business goals..."
                          className="min-h-[160px] resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ─── FOOTER ─── */}
            <div className="flex justify-between items-center p-6 border-t border-neutral-100">
              <Button type="button" variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>

              <div className="flex items-center gap-3">
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep((prev) => prev - 1)}
                  >
                    Back
                  </Button>
                )}

                {currentStep < 3 ? (
                  <Button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      setCurrentStep((prev) => prev + 1)
                    }}
                  >
                    Continue
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={mutation.isPending || isUploading}
                  >
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 size-5 animate-spin" />
                        Creating...
                      </>
                    ) : customSubmit ? (
                      'Complete Setup'
                    ) : (
                      'Create Client'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
