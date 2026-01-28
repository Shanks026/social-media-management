import { memo } from 'react'
import { Check, CheckSquare } from 'lucide-react' // Using icons instead of Radix component
import { Label } from '@/components/ui/label'
import { SUPPORTED_PLATFORMS } from '@/lib/platforms'

const PlatformSelector = memo(({ selected = [], onChange }) => {
  const togglePlatform = (id) => {
    // Standard immutable toggle
    const nextSelected = selected.includes(id)
      ? selected.filter((p) => p !== id)
      : [...selected, id]

    onChange(nextSelected)
  }

  return (
    <div className="space-y-3">
      <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Active Service Platforms
      </Label>
      <div className="grid grid-cols-2 gap-3">
        {SUPPORTED_PLATFORMS.map((platform) => {
          const Icon = platform.icon
          const isSelected = selected.includes(platform.id)

          return (
            <div
              key={platform.id}
              onClick={(e) => {
                // Simple prevention is enough now
                e.preventDefault()
                togglePlatform(platform.id)
              }}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'hover:bg-muted/50 border-transparent'
              }`}
            >
              {/* Visual "Fake" Checkbox - Zero Ref Logic overhead */}
              <div
                className={`flex items-center justify-center size-4 rounded-sm border ${
                  isSelected
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-primary/50 opacity-50'
                }`}
              >
                {isSelected && <Check className="size-3" strokeWidth={3} />}
              </div>

              <div className="flex items-center gap-2">
                <Icon
                  className="size-4"
                  style={{ color: isSelected ? platform.color : 'inherit' }}
                />
                <span className="text-sm font-medium">{platform.label}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

PlatformSelector.displayName = 'PlatformSelector'
export default PlatformSelector
