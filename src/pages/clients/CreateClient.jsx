import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/api/clients'
import { supabase } from '@/lib/supabase'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'

import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// Import your new components
import PlatformSelector from './PlatformSelector'
import { INDUSTRY_OPTIONS } from '../../lib/industries'

const createClientSchema = z.object({
  name: z.string().min(2, 'Client name is required'),
  description: z.string().optional(),
  email: z.string().email('Invalid email address'),
  mobile_number: z
    .string()
    .regex(/^\+91[6-9]\d{9}$/, 'Mobile number must start with +91'),
  status: z.enum(['ACTIVE', 'PAUSED']),
  tier: z.enum(['BASIC', 'PRO', 'VIP']),
  logo_url: z.string().optional().nullable(),
  industry: z.string().min(1, 'Industry is required'),
  platforms: z.array(z.string()).default([]),
})

export default function CreateClient({ open, onOpenChange }) {
  const queryClient = useQueryClient()
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)

  const form = useForm({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: '',
      description: '',
      email: '',
      mobile_number: '+91',
      status: 'ACTIVE',
      tier: 'BASIC',
      logo_url: null,
      platforms: [],
      industry: 'Other', // Initialize as empty array
    },
  })

  const mutation = useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client created successfully')
      resetForm()
      onOpenChange(false)
    },
    onError: () => {
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

      form.setValue('logo_url', publicUrl)
      setPreviewUrl(publicUrl)
      toast.success('Logo uploaded!')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload logo')
    } finally {
      setIsUploading(false)
    }
  }

  const removeLogo = () => {
    form.setValue('logo_url', null)
    setPreviewUrl(null)
  }

  function resetForm() {
    form.reset()
    setPreviewUrl(null)
  }

  function onSubmit(values) {
    mutation.mutate(values)
  }

  function handleCancel() {
    resetForm()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Client</DialogTitle>
          <DialogDescription>
            Onboard a new client and define their active social platforms.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-2">
          {/* Logo Section */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Branding
            </Label>
            <div className="flex items-center gap-4 p-4 rounded-xl border bg-muted/10">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-background overflow-hidden">
                {previewUrl ? (
                  <>
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="h-full w-full object-contain p-1"
                    />
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="absolute top-0.5 right-0.5 p-1 bg-destructive text-white rounded-full"
                    >
                      <X size={10} />
                    </button>
                  </>
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="max-w-[240px] h-8 text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  PNG, JPG or SVG. Max 2MB.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Identity & Settings
            </Label>

            {/* Client Name */}
            <div className="space-y-2">
              <Input
                {...form.register('name')}
                placeholder="Client Name (e.g. Los Pollos Hermanos)"
              />
              {form.formState.errors.name && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            {/* Industry Selection (Full Width) */}
            <div className="space-y-2">
              <Select
                value={form.watch('industry')}
                onValueChange={(value) => form.setValue('industry', value)}
              >
                <SelectTrigger className="w-full">
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
              {form.formState.errors.industry && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.industry.message}
                </p>
              )}
            </div>

            {/* Status and Tier (Two Columns) */}
            <div className="grid grid-cols-2 gap-4">
              <Select
                value={form.watch('status')}
                onValueChange={(value) => form.setValue('status', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PAUSED">Paused</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={form.watch('tier')}
                onValueChange={(value) => form.setValue('tier', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Service Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BASIC">Basic</SelectItem>
                  <SelectItem value="PRO">Pro</SelectItem>
                  <SelectItem value="VIP">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Platform Selection Section */}
          <Controller
            name="platforms"
            control={form.control}
            render={({ field }) => (
              <PlatformSelector
                // Use a fallback to [] to prevent undefined errors on first render
                selected={field.value || []}
                onChange={field.onChange}
              />
            )}
          />

          <div className="space-y-4">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Contact Information
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Input
                  {...form.register('email')}
                  placeholder="Primary Email"
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Input
                  {...form.register('mobile_number')}
                  placeholder="Mobile Number"
                />
                {form.formState.errors.mobile_number && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.mobile_number.message}
                  </p>
                )}
              </div>
            </div>
            <Textarea
              {...form.register('description')}
              placeholder="Description or internal notes..."
              className="resize-none"
            />
          </div>

          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || isUploading}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Onboard Client'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
