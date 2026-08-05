import { useRef, useState } from 'react'
import { Controller } from 'react-hook-form'
import { Camera, ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { INDUSTRY_OPTIONS } from '@/lib/industries'
import HorizontalLogoCropDialog from '@/components/HorizontalLogoCropDialog'
import { uploadBrandingAsset, removeBrandingAsset } from '../uploads'

export default function IdentityStep({ form }) {
  const {
    control,
    register,
    setValue,
    watch,
    formState: { errors },
  } = form

  const logoUrl = watch('logo_url')
  const horizontalLogoUrl = watch('logo_horizontal_url')

  const logoInputRef = useRef(null)
  const horizontalInputRef = useRef(null)

  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isUploadingHorizontal, setIsUploadingHorizontal] = useState(false)
  const [cropSrc, setCropSrc] = useState(null)
  const [isCropOpen, setIsCropOpen] = useState(false)

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const previous = logoUrl
    try {
      setIsUploadingLogo(true)
      const publicUrl = await uploadBrandingAsset(file, 'branding')
      setValue('logo_url', publicUrl, { shouldDirty: true })
      if (previous) await removeBrandingAsset(previous)
      toast.success('Logo uploaded')
    } catch (err) {
      console.error('Logo upload failed:', err)
      toast.error('Failed to upload logo')
    } finally {
      setIsUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  const clearLogo = (e) => {
    e.stopPropagation()
    if (logoUrl) removeBrandingAsset(logoUrl)
    setValue('logo_url', '', { shouldDirty: true })
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  const handleHorizontalPick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(URL.createObjectURL(file))
    setIsCropOpen(true)
    e.target.value = ''
  }

  const handleCropApplied = async (blob) => {
    const previous = horizontalLogoUrl
    setIsUploadingHorizontal(true)
    try {
      const publicUrl = await uploadBrandingAsset(blob, 'branding', 'png')
      setValue('logo_horizontal_url', publicUrl, { shouldDirty: true })
      if (previous) await removeBrandingAsset(previous)
      toast.success('Horizontal logo added')
    } finally {
      setIsUploadingHorizontal(false)
    }
  }

  const handleCropOpenChange = (open) => {
    setIsCropOpen(open)
    if (!open && cropSrc) {
      URL.revokeObjectURL(cropSrc)
      setCropSrc(null)
    }
  }

  const clearHorizontalLogo = (e) => {
    e.stopPropagation()
    if (horizontalLogoUrl) removeBrandingAsset(horizontalLogoUrl)
    setValue('logo_horizontal_url', '', { shouldDirty: true })
  }

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h2 className="text-2xl font-normal bricolage">
          What&apos;s your agency called?
        </h2>
        <p className="text-sm text-muted-foreground">
          This name and logo appear in your sidebar, on client emails, and across
          every document you send.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>
            Agency name <span className="text-destructive">*</span>
          </Label>
          <Input
            {...register('agency_name')}
            placeholder="e.g. Acme Social"
            autoFocus
          />
          {errors.agency_name && (
            <p className="text-xs text-destructive">
              {errors.agency_name.message}
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
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select your industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRY_OPTIONS.filter((o) => o.value !== 'Internal').map(
                    (opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            )}
          />
          {errors.industry && (
            <p className="text-xs text-destructive">{errors.industry.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <Label>
            Logos{' '}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <p className="text-xs text-muted-foreground">
            You can add these later from Settings — we&apos;ll use your agency
            name until you do.
          </p>
        </div>

        <div className="flex flex-wrap items-start gap-6">
          {/* Square logo */}
          <div className="space-y-1.5">
            <div
              onClick={() => logoInputRef.current?.click()}
              className={cn(
                'group relative flex size-28 cursor-pointer flex-col items-center justify-center rounded-full border-2 border-dashed transition-all hover:bg-muted/50',
                logoUrl ? 'border-primary/40' : 'border-border',
              )}
            >
              {logoUrl ? (
                <>
                  <div className="relative size-full overflow-hidden rounded-full border-2 border-border bg-background shadow-sm">
                    <img
                      src={logoUrl}
                      alt="Agency logo"
                      className="size-full object-cover transition-transform group-hover:scale-110"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                      <Camera className="size-5 text-white" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearLogo}
                    className="absolute -right-1 -top-1 z-20 rounded-full bg-destructive p-1 text-white shadow-lg"
                  >
                    <X className="size-3" />
                  </button>
                </>
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
            <p className="text-[11px] text-muted-foreground text-center">
              Sidebar &amp; avatars
            </p>
          </div>

          {/* Horizontal logo */}
          <div className="space-y-1.5">
            <div
              onClick={() => horizontalInputRef.current?.click()}
              className={cn(
                'group relative cursor-pointer rounded-xl border-2 border-dashed transition-all hover:bg-muted/50',
                horizontalLogoUrl
                  ? 'border-primary/40 overflow-hidden'
                  : 'border-border flex h-28 w-48 items-center justify-center',
              )}
            >
              {horizontalLogoUrl ? (
                <>
                  <img
                    src={horizontalLogoUrl}
                    alt="Horizontal logo"
                    className="block max-h-28 max-w-65 w-auto rounded-[10px]"
                  />
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera className="size-5 text-white" />
                  </div>
                  <button
                    type="button"
                    onClick={clearHorizontalLogo}
                    className="absolute right-1.5 top-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-destructive group-hover:opacity-100"
                  >
                    <X size={11} />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground transition-colors group-hover:text-foreground">
                  {isUploadingHorizontal ? (
                    <Loader2 className="size-5 animate-spin text-primary" />
                  ) : (
                    <ImagePlus className="size-5" />
                  )}
                  <span className="text-xs font-medium">Horizontal logo</span>
                </div>
              )}
              <input
                ref={horizontalInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleHorizontalPick}
                disabled={isUploadingHorizontal}
              />
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Invoices, proposals &amp; reports
            </p>
          </div>
        </div>
      </div>

      <HorizontalLogoCropDialog
        open={isCropOpen}
        onOpenChange={handleCropOpenChange}
        imageSrc={cropSrc || ''}
        onCropComplete={handleCropApplied}
      />
    </div>
  )
}
