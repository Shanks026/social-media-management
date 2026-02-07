import { memo } from 'react'
import { Check, AtSign, Link2, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SUPPORTED_PLATFORMS } from '@/lib/platforms'
import { cn } from '@/lib/utils'

const PlatformSelector = memo(
  ({ selected = [], onChange, register, errors }) => {
    const togglePlatform = (id) => {
      const nextSelected = selected.includes(id)
        ? selected.filter((p) => p !== id)
        : [...selected, id]
      onChange(nextSelected)
    }

    return (
      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
          Active Platforms & Handles
        </Label>
        <div className="grid grid-cols-1 gap-3">
          {SUPPORTED_PLATFORMS.map((platform) => {
            const isSelected = selected.includes(platform.id)
            const hasError = errors?.social_links?.[platform.id]
            const canRenderInputs = isSelected && typeof register === 'function'

            return (
              <div
                key={platform.id}
                className={cn(
                  'rounded-xl border-2 transition-all overflow-hidden',
                  isSelected
                    ? hasError
                      ? 'border-destructive bg-destructive/5'
                      : 'border-primary bg-primary/[0.03]'
                    : 'border-muted bg-transparent hover:border-muted-foreground/20',
                )}
              >
                {/* Clickable Header */}
                <div
                  onClick={() => togglePlatform(platform.id)}
                  className="flex items-center justify-between p-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'size-5 rounded border flex items-center justify-center',
                        isSelected
                          ? 'bg-primary border-primary text-white'
                          : 'border-muted-foreground/30',
                        hasError &&
                          isSelected &&
                          'bg-destructive border-destructive',
                      )}
                    >
                      {isSelected && !hasError && (
                        <Check size={12} strokeWidth={4} />
                      )}
                      {isSelected && hasError && (
                        <AlertCircle size={12} strokeWidth={3} />
                      )}
                    </div>
                    <platform.icon
                      className="size-4"
                      style={{ color: isSelected ? platform.color : 'inherit' }}
                    />
                    <span className="text-sm font-semibold">
                      {platform.label}
                    </span>
                  </div>
                </div>

                {/* Handle & URL Inputs */}
                {canRenderInputs && (
                  <div className="px-4 pb-4 grid grid-cols-2 gap-3 animate-in slide-in-from-top-2 duration-200">
                    <div className="space-y-1">
                      <div className="relative">
                        <AtSign className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                        <Input
                          {...register(`social_links.${platform.id}.handle`)}
                          placeholder="@velvetandvine" // CLEAR PLACEHOLDER
                          className={cn(
                            'h-8 pl-8 text-xs bg-background',
                            hasError?.handle &&
                              'border-destructive focus-visible:ring-destructive',
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="relative">
                        <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                        <Input
                          {...register(`social_links.${platform.id}.url`)}
                          placeholder="https://instagram.com/velvetandvine" // CLEAR PLACEHOLDER
                          className={cn(
                            'h-8 pl-8 text-xs bg-background',
                            hasError?.url &&
                              'border-destructive focus-visible:ring-destructive',
                          )}
                        />
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
