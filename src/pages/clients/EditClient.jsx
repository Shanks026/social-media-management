import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateClient } from '@/api/clients'
import { supabase } from '@/lib/supabase'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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

// Shared Components & Constants
import PlatformSelector from './PlatformSelector'
import { INDUSTRY_OPTIONS } from '../../lib/industries'

const editClientSchema = z.object({
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

export default function EditClient({ client, onClose }) {
  const queryClient = useQueryClient()
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)

  const form = useForm({
    resolver: zodResolver(editClientSchema),
    defaultValues: {
      name: '',
      description: '',
      email: '',
      mobile_number: '+91',
      status: 'ACTIVE',
      tier: 'BASIC',
      logo_url: null,
      industry: 'Other',
      platforms: [],
    },
  })

  // Sync form with client data when opened
  useEffect(() => {
    if (client) {
      form.reset({
        name: client.name ?? '',
        description: client.description ?? '',
        email: client.email ?? '',
        mobile_number: client.mobile_number ?? '+91',
        status: client.status ?? 'ACTIVE',
        tier: client.tier ?? 'BASIC',
        logo_url: client.logo_url ?? null,
        industry: client.industry ?? 'Other',
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

      form.setValue('logo_url', publicUrl, { shouldDirty: true })
      setPreviewUrl(publicUrl)
      toast.success('Logo updated!')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload logo')
    } finally {
      setIsUploading(false)
    }
  }

  const removeLogo = () => {
    form.setValue('logo_url', null, { shouldDirty: true })
    setPreviewUrl(null)
  }

  function onSubmit(values) {
    mutation.mutate({
      id: client.id,
      ...values,
    })
  }

  return (
    <Dialog open={!!client} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
          <DialogDescription>
            Update branding, service tier, and active platforms for{' '}
            {client?.name}.
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
              <Input {...form.register('name')} placeholder="Client Name" />
              {form.formState.errors.name && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            {/* Industry Selection */}
            <div className="space-y-2">
              <Select
                value={form.watch('industry')}
                onValueChange={(value) =>
                  form.setValue('industry', value, { shouldDirty: true })
                }
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

            {/* Status and Tier */}
            <div className="grid grid-cols-2 gap-4">
              <Select
                value={form.watch('status')}
                onValueChange={(value) =>
                  form.setValue('status', value, { shouldDirty: true })
                }
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
                onValueChange={(value) =>
                  form.setValue('tier', value, { shouldDirty: true })
                }
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
                selected={field.value || []}
                onChange={(val) => {
                  field.onChange(val)
                  form.setValue('platforms', val, { shouldDirty: true })
                }}
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
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                mutation.isPending || isUploading || !form.formState.isDirty
              }
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
