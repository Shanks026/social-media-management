import { useRef, useState } from 'react'
import { Loader2, PenLine, X } from 'lucide-react'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { uploadBrandingAsset, removeBrandingAsset } from '../uploads'

export default function SignatoryStep({ form }) {
  const { register, setValue, watch } = form
  const signatureUrl = watch('signature_url')

  const inputRef = useRef(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const previous = signatureUrl
    try {
      setIsUploading(true)
      const publicUrl = await uploadBrandingAsset(file, 'signatures')
      setValue('signature_url', publicUrl, { shouldDirty: true })
      if (previous) await removeBrandingAsset(previous)
      toast.success('Signature added')
    } catch (err) {
      console.error('Signature upload failed:', err)
      toast.error('Failed to upload signature')
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const clearSignature = () => {
    if (signatureUrl) removeBrandingAsset(signatureUrl)
    setValue('signature_url', '', { shouldDirty: true })
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h2 className="text-2xl font-normal bricolage">Who signs your invoices?</h2>
        <p className="text-sm text-muted-foreground">
          This name, title and signature appear at the bottom of every invoice you
          send. All optional — you can set it up later in Settings.
        </p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input
              {...register('signatory_name')}
              placeholder="e.g. Chris Austin"
            />
          </div>
          <div className="space-y-2">
            <Label>Designation</Label>
            <Input
              {...register('signatory_designation')}
              placeholder="e.g. Founder"
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label>Signature image</Label>
          {signatureUrl ? (
            <div className="relative inline-block">
              <div className="rounded-lg border border-border bg-muted/20 p-4 pr-10">
                <img
                  src={signatureUrl}
                  alt="Signature preview"
                  className="h-16 max-w-55 object-contain"
                />
              </div>
              <button
                type="button"
                onClick={clearSignature}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-1 text-white shadow"
              >
                <X className="size-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              className={cn(
                'flex w-fit items-center gap-3 rounded-lg border-2 border-dashed border-border px-5 py-4 text-sm text-muted-foreground',
                'cursor-pointer transition-colors hover:border-primary/40 hover:text-foreground',
              )}
            >
              {isUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PenLine className="size-4" />
              )}
              {isUploading ? 'Uploading...' : 'Upload signature image'}
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
            disabled={isUploading}
          />
          <p className="text-xs text-muted-foreground">
            A PNG with a transparent background works best.
          </p>
        </div>
      </div>
    </div>
  )
}
