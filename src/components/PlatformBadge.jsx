import { Badge } from '@/components/ui/badge'

const PLATFORM_CONFIG = {
  instagram: {
    label: 'Instagram',
    className:
      'bg-violet-100 text-violet-800 dark:bg-violet-500/10 dark:text-violet-400',
  },
  linkedin: {
    label: 'LinkedIn',
    className:
      'bg-blue-100 text-blue-800 dark:bg-blue-600/10 dark:text-blue-400',
  },
  facebook: {
    label: 'Facebook',
    className:
      'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-400',
  },
  google_ads: {
    label: 'Google Ads',
    className:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-400',
  },
  youtube: {
    label: 'YouTube',
    className: 'bg-red-100 text-red-800 dark:bg-red-600/10 dark:text-red-400',
  },
}

export default function PlatformBadge({ platform }) {
  const platformName = typeof platform === 'string' ? platform : ''
  const key = platformName.toLowerCase().replace(' ', '_')

  const config = PLATFORM_CONFIG[key] ?? {
    label: platformName || 'Unknown',
    className:
      'bg-muted text-muted-foreground dark:bg-secondary dark:text-secondary-foreground',
  }

  if (!platformName) return null

  return (
    <Badge
      variant="none"
      className={`rounded-md px-2.5 py-1 capitalize border-none shadow-none whitespace-nowrap transition-colors ${config.className}`}
    >
      {config.label}
    </Badge>
  )
}
