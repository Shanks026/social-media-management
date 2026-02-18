import { memo } from 'react'
import { Check, AtSign, Link2, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SUPPORTED_PLATFORMS } from '@/lib/platforms'
import { cn } from '@/lib/utils'

const getBaseUrl = (id) => {
  const bases = {
    instagram: 'instagram.com/',
    twitter: 'x.com/',
    linkedin: 'linkedin.com/in/',
    facebook: 'facebook.com/',
    youtube: 'youtube.com/@',
    google_business: '',
  }
  return bases[id] || ''
}

const PlatformSelector = memo(
  ({ selected = [], onChange, register, errors, setValue, watch }) => {
    const togglePlatform = (id) => {
      const nextSelected = selected.includes(id)
        ? selected.filter((p) => p !== id)
        : [...selected, id]
      onChange(nextSelected)
    }

    const socialLinks = watch('social_links') || {}

    return (
      <div className="space-y-4">
        <Label className="text-base font-semibold">
          Active Platforms & Handles
        </Label>
        <div className="grid grid-cols-1 gap-4">
          {SUPPORTED_PLATFORMS.map((platform) => {
            const isSelected = selected.includes(platform.id)
            const hasError = errors?.social_links?.[platform.id]
            const currentHandle = socialLinks[platform.id]?.handle || ''

            const handleInputChange = (e) => {
              // 1. Sanitize: No spaces, strip the @ if they type it
              let val = e.target.value.replace(/\s/g, '')
              if (val.startsWith('@')) val = val.slice(1)

              // 2. Set handle
              setValue(`social_links.${platform.id}.handle`, val, {
                shouldValidate: true,
              })

              // 3. Auto-update URL (GMB remains manual)
              if (platform.id !== 'google_business') {
                const fullUrl = val
                  ? `https://${getBaseUrl(platform.id)}${val}`
                  : ''
                setValue(`social_links.${platform.id}.url`, fullUrl)
              }
            }

            return (
              <div
                key={platform.id}
                className={cn(
                  'rounded-lg border transition-all bg-card/50 text-card-foreground shadow-sm',
                  isSelected ? 'border-primary' : 'border-border',
                )}
              >
                {/* Header: Select/Deselect */}
                <div
                  onClick={() => togglePlatform(platform.id)}
                  className="flex items-center justify-between p-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'size-5 rounded border flex items-center justify-center transition-colors',
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-input bg-background',
                      )}
                    >
                      {isSelected && (
                        <Check className="size-3.5" strokeWidth={3} />
                      )}
                    </div>
                    <img
                      src={`/platformIcons/${platform.id === 'google_business' ? 'google_busines' : platform.id}.png`}
                      alt={platform.label}
                      className={cn(
                        'size-5 object-contain',
                        !isSelected && 'grayscale opacity-50',
                      )}
                    />
                    <span
                      className={cn(
                        'text-sm font-medium',
                        !isSelected && 'text-muted-foreground',
                      )}
                    >
                      {platform.label}
                    </span>
                  </div>
                  {hasError && isSelected && (
                    <AlertCircle className="size-4 text-destructive" />
                  )}
                </div>

                {/* Expansion Area: Handle & URL */}
                {isSelected && (
                  <div className="px-4 pb-4 space-y-4 animate-in fade-in slide-in-from-top-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Handle Input */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">
                          Username / Handle
                        </Label>
                        <div className="relative">
                          <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                          <Input
                            {...register(`social_links.${platform.id}.handle`)}
                            onChange={handleInputChange}
                            placeholder="username"
                            className={cn(
                              'pl-9',
                              hasError?.handle &&
                                'border-destructive focus-visible:ring-destructive',
                            )}
                          />
                        </div>
                        {hasError?.handle && (
                          <p className="text-[10px] text-destructive font-medium">
                            {hasError.handle.message || 'Required'}
                          </p>
                        )}
                      </div>

                      {/* URL Input */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">
                          Profile URL
                        </Label>
                        <div className="relative">
                          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                          <Input
                            {...register(`social_links.${platform.id}.url`)}
                            placeholder={
                              platform.id === 'google_business'
                                ? 'Paste Maps URL'
                                : 'Auto-generated'
                            }
                            readOnly={platform.id !== 'google_business'}
                            className={cn(
                              'pl-9',
                              platform.id !== 'google_business' &&
                                'bg-muted cursor-not-allowed text-muted-foreground',
                              hasError?.url && 'border-destructive',
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  },
)

PlatformSelector.displayName = 'PlatformSelector'
export default PlatformSelector
