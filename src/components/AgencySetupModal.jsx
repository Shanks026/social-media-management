import { useState, useRef, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { completeFullAgencySetup, setupBrandingOnly } from '@/api/agency'
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
  ImagePlus,
  Lock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

// Shared Components
import PlatformSelector from '@/pages/clients/PlatformSelector'

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
      url: z.string().trim().url().or(z.string().length(0)).optional(),
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

export function AgencySetupModal({
  user,
  mode = 'full',
  initialData = null, // <--- New Prop for Path B Pre-filling
  onComplete,
  onClose,
}) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  const form = useForm({
    resolver: zodResolver(setupSchema),
    mode: 'onSubmit',
    // Pre-fill form with initialData (Path B) if available
    defaultValues: {
      name: initialData?.agency_name || '',
      logo_url: initialData?.logo_url || '',
      status: 'ACTIVE',
      tier: 'PRO',
      industry: 'Marketing Agency',
      platforms: [],
      social_links: initialData?.social_links || {}, // Pre-fill links if they exist
      email: user?.email || '',
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
  }, [selectedPlatforms])

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
      if (mode === 'branding') {
        await setupBrandingOnly(data)
        toast.success('Visual identity updated!')
      } else {
        await completeFullAgencySetup(data)
        toast.success('Agency workspace ready!')
      }
      onComplete()
    } catch (error) {
      console.error(error)
      toast.error('Submission failed. Check your network or permissions.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNext = async () => {
    const fields = STEPS[currentStep - 1].fields
    const isValid = await form.trigger(fields)
    if (isValid) setCurrentStep((prev) => Math.min(STEPS.length, prev + 1))
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-background shadow-xl border-none">
        <div className="p-10">
          <DialogHeader className="mb-8 text-left">
            <DialogTitle className="text-3xl font-medium tracking-tight">
              {mode === 'branding'
                ? 'Brand your workspace'
                : 'Setup your agency'}
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground mt-2">
              Step {currentStep} of 3 — {STEPS[currentStep - 1].title}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-start gap-3 mb-10">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={cn(
                  'h-0.5 transition-all duration-500 rounded-full',
                  currentStep === step.id ? 'w-10 bg-primary' : 'w-4 bg-muted',
                )}
              />
            ))}
          </div>

          <form
            onSubmit={form.handleSubmit(onFormSubmit)}
            className="space-y-8"
          >
            <div className="min-h-[380px]">
              {/* STEP 1: BRANDING */}
              {currentStep === 1 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="flex flex-col items-center justify-center">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        'group relative size-28 rounded-2xl border border-dashed transition-all cursor-pointer flex items-center justify-center overflow-hidden',
                        form.watch('logo_url')
                          ? 'border-primary/20'
                          : 'border-muted-foreground/20',
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
                        <div className="text-center text-muted-foreground">
                          {isUploading ? (
                            <Loader2 className="size-5 animate-spin text-primary" />
                          ) : (
                            <ImagePlus className="size-5 mx-auto opacity-40" />
                          )}
                          <span className="text-[10px] font-medium mt-2 block tracking-tight">
                            Logo
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
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Agency name</Label>
                      <Input
                        {...form.register('name')}
                        placeholder="e.g. Nexus Media"
                        className="h-11"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Internal status
                        </Label>
                        <Select
                          value={form.watch('status')}
                          onValueChange={(v) => form.setValue('status', v)}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ACTIVE">Active</SelectItem>
                            <SelectItem value="PAUSED">Paused</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 opacity-60">
                        <Label className="text-sm font-medium flex items-center gap-1">
                          Workspace Tier <Lock size={12} />
                        </Label>
                        <Input
                          disabled
                          value={form.watch('tier')}
                          className="bg-muted h-11"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: BUSINESS */}
              {currentStep === 2 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="space-y-2 opacity-60">
                    <Label className="text-sm font-medium flex items-center gap-1">
                      Industry <Lock size={12} />
                    </Label>
                    <Input
                      disabled
                      value="Marketing Agency"
                      className="bg-muted h-11"
                    />
                  </div>
                  <div className="space-y-4">
                    <Label className="text-sm font-medium">
                      Service platforms
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

              {/* STEP 3: CONTACT */}
              {currentStep === 3 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 opacity-60">
                      <Label className="text-sm font-medium flex items-center gap-1">
                        Account email <Lock size={12} />
                      </Label>
                      <Input
                        disabled
                        value={user?.email}
                        className="bg-muted h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Phone number
                      </Label>
                      <Input
                        {...form.register('mobile_number')}
                        placeholder="+91"
                        className="h-11"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Notes</Label>
                    <Textarea
                      {...form.register('description')}
                      placeholder="Vision for your agency..."
                      className="min-h-[120px] resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-8 border-t border-muted/20">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCurrentStep((s) => s - 1)}
                disabled={currentStep === 1}
                className="font-medium hover:bg-transparent px-0"
              >
                <ChevronLeft className="size-4 mr-2" /> Back
              </Button>
              {currentStep < 3 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="h-10 px-8 font-medium rounded-lg"
                >
                  Continue <ChevronRight className="size-4 ml-2" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 px-10 font-medium rounded-lg"
                >
                  {isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    'Complete setup'
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
