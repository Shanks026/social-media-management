import { useState, useRef, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { completeAgencySetup } from '@/api/agency'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// Shadcn & UI
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
import {
  Loader2,
  X,
  Check,
  Camera,
  ImagePlus,
  AlertCircle,
  Lock,
} from 'lucide-react'

// Shared Components/Constants
import PlatformSelector from '@/pages/clients/PlatformSelector'
import { INDUSTRY_OPTIONS } from '@/lib/industries'

// --- SCHEMA ---
const setupSchema = z.object({
  name: z.string().trim().min(2, 'Agency name is required'),
  logo_url: z.string().min(1, 'Agency logo is required'),
  status: z.enum(['ACTIVE', 'PAUSED']),
  tier: z.enum(['BASIC', 'PRO', 'VIP']),
  industry: z.string().min(1, 'Industry is required'),
  platforms: z.array(z.string()).min(1, 'Select at least one platform'),
  social_links: z.object({}).catchall(
    z.object({
      handle: z.string().trim().min(1, 'Handle is required'),
      url: z
        .string()
        .trim()
        .url('Must be a valid URL (https://...)')
        .or(z.string().length(0))
        .optional(),
    }),
  ),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  mobile_number: z
    .string()
    .min(1, 'Mobile is required')
    .regex(/^\+91[6-9]\d{9}$/, 'Must be a valid +91 number'),
  description: z.string().optional(),
})

const STEPS = [
  { id: 1, title: 'Branding', fields: ['logo_url', 'name', 'status', 'tier'] },
  {
    id: 2,
    title: 'Business',
    fields: ['industry', 'platforms', 'social_links'],
  },
  {
    id: 3,
    title: 'Contact',
    fields: ['email', 'mobile_number', 'description'],
  },
]

export function AgencySetupModal({ user, onComplete }) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  const form = useForm({
    resolver: zodResolver(setupSchema),
    mode: 'onSubmit',
    defaultValues: {
      name: '',
      logo_url: '',
      status: 'ACTIVE',
      tier: 'PRO', // LOCKED
      industry: 'Marketing Agency', // LOCKED
      platforms: [],
      social_links: {},
      email: user?.email || '', // LOCKED
      mobile_number: '+91',
      description: '',
    },
  })

  const { errors } = form.formState
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

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      const fileName = `${Date.now()}.${file.name.split('.').pop()}`
      const { error } = await supabase.storage
        .from('post-media')
        .upload(`branding/${fileName}`, file)
      if (error) throw error
      const {
        data: { publicUrl },
      } = supabase.storage
        .from('post-media')
        .getPublicUrl(`branding/${fileName}`)
      form.setValue('logo_url', publicUrl, { shouldValidate: true })
      toast.success('Logo uploaded!')
    } catch (err) {
      toast.error('Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const onFormSubmit = async (data) => {
    setIsSubmitting(true)
    try {
      await completeAgencySetup(data)
      toast.success('Agency workspace ready!')
      onComplete()
    } catch (error) {
      console.error(error)
      toast.error('Setup failed. Please check if your user session is active.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const onFormError = (err) => {
    const firstErrorStep = STEPS.find((step) =>
      step.fields.some(
        (field) => err[field] || (field === 'social_links' && err.social_links),
      ),
    )
    if (firstErrorStep) {
      setCurrentStep(firstErrorStep.id)
      toast.error(`Please fix errors in the ${firstErrorStep.title} step`)
    }
  }

  const stepHasError = (id) =>
    STEPS.find((s) => s.id === id)?.fields.some(
      (f) => errors[f] || (f === 'social_links' && errors.social_links),
    )

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-background dark:bg-zinc-950 shadow-2xl border-none">
        <div className="p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-bold tracking-tight">
              Setup Your Agency
            </DialogTitle>
            <DialogDescription>
              Step {currentStep} of 3: {STEPS[currentStep - 1].title}
            </DialogDescription>
          </DialogHeader>

          {/* STEPPER */}
          <div className="flex items-center justify-between mb-8 px-2">
            {STEPS.map((step) => {
              const isError = stepHasError(step.id)
              const isActive = currentStep === step.id
              const isCompleted = currentStep > step.id
              return (
                <div key={step.id} className="flex items-center gap-2">
                  <div
                    className={cn(
                      'size-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                      isError
                        ? 'bg-destructive border-destructive text-white animate-pulse'
                        : isActive
                          ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                          : isCompleted
                            ? 'border-primary text-primary'
                            : 'border-muted text-muted-foreground',
                    )}
                  >
                    {isError ? (
                      <AlertCircle size={14} />
                    ) : isCompleted ? (
                      <Check size={14} strokeWidth={3} />
                    ) : (
                      step.id
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs font-semibold hidden sm:inline',
                      isError
                        ? 'text-destructive'
                        : isActive
                          ? 'text-foreground'
                          : 'text-muted-foreground',
                    )}
                  >
                    {step.title}
                  </span>
                  {step.id < 3 && (
                    <div className="w-8 md:w-12 h-px bg-muted mx-1" />
                  )}
                </div>
              )
            })}
          </div>

          <form
            onSubmit={form.handleSubmit(onFormSubmit, onFormError)}
            className="space-y-6"
          >
            <div className="min-h-[350px]">
              {/* STEP 1 */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex flex-col items-center justify-center py-2">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        'group relative size-32 rounded-full border-2 border-dashed transition-all cursor-pointer flex items-center justify-center overflow-hidden',
                        form.watch('logo_url')
                          ? 'border-primary/20'
                          : 'border-muted-foreground/25',
                        errors.logo_url &&
                          'border-destructive bg-destructive/5',
                      )}
                    >
                      {form.watch('logo_url') ? (
                        <img
                          src={form.watch('logo_url')}
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="text-center text-muted-foreground group-hover:text-primary transition-colors">
                          {isUploading ? (
                            <Loader2 className="size-6 animate-spin text-primary" />
                          ) : (
                            <ImagePlus className="size-6 mx-auto" />
                          )}
                          <span className="text-[10px] font-bold uppercase mt-1 block">
                            Logo *
                          </span>
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileUpload}
                    />
                    {errors.logo_url && (
                      <p className="text-[10px] text-destructive mt-2">
                        {errors.logo_url.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        Agency Name *
                      </Label>
                      <Input
                        {...form.register('name')}
                        placeholder="e.g. Nexus Media"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">
                          Internal Status
                        </Label>
                        <Select
                          value={form.watch('status')}
                          onValueChange={(v) => form.setValue('status', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ACTIVE">Active</SelectItem>
                            <SelectItem value="PAUSED">Paused</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 opacity-80">
                        <Label className="text-xs font-semibold flex items-center gap-1">
                          Workspace Tier <Lock size={10} />
                        </Label>
                        <Input
                          disabled
                          value="PRO"
                          className="bg-muted cursor-not-allowed h-10"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {currentStep === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-2 opacity-80">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      Industry Vertical <Lock size={10} />
                    </Label>
                    <Input
                      disabled
                      value="Marketing Agency"
                      className="bg-muted cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Service Platforms
                    </Label>
                    <Controller
                      name="platforms"
                      control={form.control}
                      render={({ field }) => (
                        <PlatformSelector
                          selected={field.value}
                          onChange={field.onChange}
                          register={form.register}
                          errors={errors}
                        />
                      )}
                    />
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {currentStep === 3 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 opacity-80">
                      <Label className="text-xs font-semibold flex items-center gap-1">
                        Primary Email <Lock size={10} />
                      </Label>
                      <Input
                        disabled
                        value={user?.email}
                        className="bg-muted cursor-not-allowed"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        Agency Phone *
                      </Label>
                      <Input
                        {...form.register('mobile_number')}
                        placeholder="+91"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">
                      Workspace Notes
                    </Label>
                    <Textarea
                      {...form.register('description')}
                      placeholder="Vision for your own agency content..."
                      className="min-h-[140px] resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-6 border-t border-muted/50">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCurrentStep((s) => s - 1)}
                disabled={currentStep === 1}
              >
                Back
              </Button>
              {currentStep < 3 ? (
                <Button
                  type="button"
                  onClick={() => setCurrentStep((s) => s + 1)}
                  className="min-w-[120px]"
                >
                  Continue
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-w-[140px]"
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    'Complete Setup'
                  )}
                </Button>
              )}
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
