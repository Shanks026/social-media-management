import { Input } from '@/components/ui/input'
import { Search, AlertCircle, Moon, AlertTriangle, X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { INDUSTRY_OPTIONS } from '@/lib/industries'
import { cn } from '@/lib/utils'
import { useState, useEffect, useRef } from 'react'

/* ----------------------------------------------------
   1. Search Bar
---------------------------------------------------- */
export const SearchBar = ({ value, onChange }) => {
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const applySearch = () => onChange(localValue)

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') applySearch()
  }

  const handleClear = () => {
    setLocalValue('')
    onChange('')
  }

  const handleChange = (e) => {
    const next = e.target.value
    setLocalValue(next)
    if (next === '') onChange('')
  }

  return (
    <div className="relative w-[240px]">
      <button
        type="button"
        onClick={applySearch}
        aria-label="Apply search"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      >
        <Search className="size-4" />
      </button>

      <Input
        placeholder="Search clients"
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="h-9 pl-9 pr-9 text-sm"
      />

      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

/* ----------------------------------------------------
   2. Urgency Filter (normalized size)
---------------------------------------------------- */
export const UrgencyFilter = ({ activeValue, onSelect, counts = {} }) => {
  const options = [
    {
      label: 'All',
      value: 'all',
      count: counts.all,
    },
    {
      label: 'Urgent',
      value: 'urgent',
      icon: <AlertCircle className="size-4" />,
      count: counts.urgent,
      activeColor: 'text-red-600 dark:text-red-400',
      // Persistent red logic remains here
      persistentColor:
        counts.urgent > 0
          ? 'bg-red-100 text-red-600 dark:bg-red-900/30'
          : 'bg-muted text-muted-foreground',
    },
    {
      label: 'Upcoming',
      value: 'upcoming',
      icon: <AlertTriangle className="size-4" />,
      count: counts.upcoming,
      activeColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'Idle',
      value: 'idle',
      icon: <Moon className="size-4" />,
      count: counts.idle,
      activeColor: 'text-blue-600 dark:text-blue-400',
    },
  ]

  return (
    <div className="flex items-center gap-1 rounded-md border p-0.5 bg-background shadow-sm">
      {options.map((opt) => {
        const isActive = activeValue === opt.value
        const isUrgentHighlight = opt.value === 'urgent' && opt.count > 0

        return (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            className={cn(
              'h-8 px-3 py-1 inline-flex items-center gap-2 rounded-sm text-sm font-medium transition-all shrink-0',
              isActive
                ? cn(
                    'bg-muted/60 shadow-inner',
                    opt.activeColor || 'text-foreground',
                  )
                : isUrgentHighlight
                  ? 'text-red-600 dark:text-red-400 hover:bg-muted/40'
                  : 'text-muted-foreground hover:bg-muted/40',
            )}
          >
            {/* Icons only colorize if active, or if it's the urgent highlight */}
            {opt.icon && (
              <span
                className={cn(
                  'shrink-0',
                  isActive || isUrgentHighlight ? '' : 'text-muted-foreground',
                )}
              >
                {opt.icon}
              </span>
            )}

            <span>{opt.label}</span>

            {/* Count Badge Logic */}
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-bold transition-colors min-w-[1.5rem] text-center',
                isActive
                  ? 'bg-background shadow-sm' // Selected state (neutral background)
                  : isUrgentHighlight
                    ? opt.persistentColor // Urgent stays red if count > 0
                    : 'bg-muted text-muted-foreground', // Everything else neutral
              )}
            >
              {opt.count || 0}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ----------------------------------------------------
   3. Industry Filter (normalized size)
---------------------------------------------------- */
export const IndustryFilter = ({ value, onValueChange }) => {
  const showClear = value && value !== 'all'
  const triggerRef = useRef(null)

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger ref={triggerRef} className="w-[150px] h-9 text-sm">
        <div className="flex items-center gap-2 flex-1 overflow-hidden">
          <SelectValue placeholder="Industry" />

          {showClear && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onValueChange('all')
                triggerRef.current?.blur()
              }}
              className="text-muted-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="all">All Industries</SelectItem>
        {INDUSTRY_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/* ----------------------------------------------------
   4. Tier Filter (normalized size)
---------------------------------------------------- */
export const TierFilter = ({ value, onValueChange }) => {
  const showClear = value && value !== 'all'
  const triggerRef = useRef(null)

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger ref={triggerRef} className="w-[110px] h-9 text-sm">
        <div className="flex items-center gap-2 flex-1 overflow-hidden">
          <SelectValue placeholder="Tier" />

          {showClear && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onValueChange('all')
                triggerRef.current?.blur()
              }}
              className="text-muted-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="all">All Tiers</SelectItem>
        <SelectItem value="VIP">VIP</SelectItem>
        <SelectItem value="PRO">PRO</SelectItem>
        <SelectItem value="BASIC">Basic</SelectItem>
      </SelectContent>
    </Select>
  )
}
