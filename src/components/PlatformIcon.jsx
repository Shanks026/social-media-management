import { Instagram, Linkedin, Twitter, Facebook, Youtube, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { platformById, platformId, platformLabel, platformLogo } from '@/lib/domain/platforms'

const CHIP_ICONS = {
  instagram: Instagram,
  linkedin: Linkedin,
  twitter: Twitter,
  facebook: Facebook,
  youtube: Youtube,
  google_business: Globe,
}

/**
 * One platform mark (#151).
 *   variant="logo" (default): the brand logo in a round white frame.
 *   variant="chip": a solid brand-coloured circle with a line icon.
 * `size` is the outer diameter in px.
 */
export function PlatformIcon({ platform, size = 20, variant = 'logo', className, style }) {
  const id = platformId(platform)
  const info = platformById(platform)

  if (variant === 'chip') {
    const Icon = CHIP_ICONS[id]
    if (!Icon) return null
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full text-white',
          id === 'twitter' && 'dark:text-black dark:bg-white',
          className,
        )}
        style={{ width: size, height: size, backgroundColor: info?.color }}
        title={platformLabel(platform)}
      >
        <Icon style={{ width: size * 0.55, height: size * 0.55 }} />
      </span>
    )
  }

  if (!info) {
    // Unknown platform: a neutral tile with its first letter.
    const letter = typeof platform === 'string' ? platform[0]?.toUpperCase() : '?'
    return (
      <span
        style={{ width: size, height: size, fontSize: size * 0.45 }}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground',
          className,
        )}
      >
        {letter}
      </span>
    )
  }

  return (
    <span
      style={{ width: size, height: size, ...style }}
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-white shadow-sm dark:bg-zinc-900',
        className,
      )}
      title={info.label}
    >
      <img
        src={platformLogo(platform)}
        alt={info.label}
        style={{ width: size * 0.78, height: size * 0.78 }}
        className="object-contain"
        onError={(e) => (e.target.style.display = 'none')}
      />
    </span>
  )
}

/**
 * Overlapping platform icon stack — shows up to `max` icons, then a +n bubble.
 */
export function PlatformStack({ platforms = [], max = 3, size = 22 }) {
  if (!platforms.length) return null

  const visible = platforms.slice(0, max)
  const overflow = platforms.length - max

  return (
    <div className="flex items-center">
      {visible.map((p, i) => (
        <PlatformIcon
          key={p}
          platform={p}
          size={size}
          className="relative ring-2 ring-background"
          style={{ marginLeft: i === 0 ? 0 : -6, zIndex: visible.length - i }}
        />
      ))}
      {overflow > 0 && (
        <span
          style={{ width: size, height: size, marginLeft: -6, fontSize: size * 0.38 }}
          className="relative z-0 flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground ring-2 ring-background"
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}

/** Recharts axis tick that draws the platform logo; shared by every platform chart. */
export function PlatformChartTick({ x, y, payload }) {
  return (
    <g transform={`translate(${x - 30},${y - 12})`}>
      <image href={platformLogo(payload.value)} height="24" width="24" />
    </g>
  )
}
