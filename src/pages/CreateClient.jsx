import { useState } from 'react' // Added for upload state
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/api/clients'
import { supabase } from '@/lib/supabase' // Import supabase for storage

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
import { Loader2, Upload, X } from 'lucide-react' // Added icons
import { toast } from 'sonner'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const createClientSchema = z.object({
  name: z.string().min(2, 'Client name is required'),
  description: z.string().optional(),
  email: z.string().email('Invalid email address'),
  mobile_number: z
    .string()
    .regex(/^\+91[6-9]\d{9}$/, 'Mobile number must start with +91'),
  status: z.enum(['ACTIVE', 'PAUSED']),
  logo_url: z.string().optional().nullable(), // Added logo_url
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
      logo_url: null,
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

      // 1. Define the path.
      // We put it in a 'branding' folder inside the 'post-media' bucket.
      // We use a timestamp to avoid name collisions.
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `branding/${fileName}` // Virtual folder creation happens here

      // 2. Upload to the existing 'post-media' bucket
      const { error: uploadError } = await supabase.storage
        .from('post-media')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // 3. Get the Public URL so everyone can see the logo on the review page
      const {
        data: { publicUrl },
      } = supabase.storage.from('post-media').getPublicUrl(filePath)

      // 4. Save this URL to the form state
      form.setValue('logo_url', publicUrl)
      setPreviewUrl(publicUrl)

      toast.success('Logo uploaded to branding folder!')
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Client</DialogTitle>
          <DialogDescription>
            Create and onboard a client with their branding details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Logo Upload Section */}
          <div className="space-y-2">
            <Label>Client Logo</Label>
            <div className="flex items-center gap-4">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 overflow-hidden">
                {previewUrl ? (
                  <>
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="h-full w-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="absolute top-1 right-1 p-1 bg-destructive text-white rounded-full hover:bg-destructive/90"
                    >
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <Upload className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="max-w-[250px] text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  PNG, JPG or SVG. Max 2MB.
                </p>
              </div>
              {isUploading && (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Client Name */}
            <div className="space-y-2">
              <Label>Client Name *</Label>
              <Input {...form.register('name')} placeholder="John Doe" />
              {form.formState.errors.name && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status *</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(value) => form.setValue('status', value)}
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
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              {...form.register('description')}
              placeholder="Description or notes about the client"
            />
          </div>

          {/* Email & Mobile */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                {...form.register('email')}
                placeholder="example@email.com"
              />
              {form.formState.errors.email && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Mobile *</Label>
              <Input {...form.register('mobile_number')} />
              {form.formState.errors.mobile_number && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.mobile_number.message}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || isUploading}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Client'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
