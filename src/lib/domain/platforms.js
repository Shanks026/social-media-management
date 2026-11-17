// Social platforms: the one list (#77, #151). Pure data, no JSX or icons
// (PlatformIcon in src/components owns the drawing).
//
// The stored id never changes: Twitter stays `twitter`, shown as "X".

export const PLATFORMS = [
  {
    id: 'instagram',
    label: 'Instagram',
    color: '#E4405F',
    enabled: true,
    selectedClass:
      'border-pink-400 bg-pink-50 text-pink-700 dark:border-pink-500/50 dark:bg-pink-500/15 dark:text-pink-300',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    color: '#0077B5',
    enabled: true,
    selectedClass:
      'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-600/15 dark:text-blue-300',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    color: '#1877F2',
    enabled: true,
    selectedClass:
      'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-500/50 dark:bg-sky-500/15 dark:text-sky-300',
  },
  {
    id: 'twitter',
    label: 'X',
    color: '#000000',
    enabled: true,
    selectedClass:
      'border-slate-700 bg-slate-100 text-slate-900 dark:border-slate-400/50 dark:bg-slate-500/15 dark:text-slate-200',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    color: '#FF0000',
    enabled: true,
    selectedClass:
      'border-red-500 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-600/15 dark:text-red-300',
  },
  {
    // Listed so stored data still resolves, but not offered anywhere yet.
    id: 'google_business',
    label: 'Google Business',
    color: '#4285F4',
    enabled: false,
    selectedClass:
      'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-300',
  },
]

/** The platforms a user can pick today. */
export const ENABLED_PLATFORMS = PLATFORMS.filter((p) => p.enabled)

const byId = Object.fromEntries(PLATFORMS.map((p) => [p.id, p]))

/** Normalise a stored or typed platform name to its id ("Google Business" → google_business). */
export function platformId(value) {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, '_') : ''
}

/** The platform record for an id (case-insensitive), or undefined. */
export const platformById = (value) => byId[platformId(value)]

/** Display label for an id; unknown ids are returned as they came. */
export function platformLabel(value) {
  return platformById(value)?.label ?? (value ? String(value) : '')
}

/** Path of the platform's logo image. */
export const platformLogo = (value) => `/platformIcons/${platformId(value)}.png`

/**
 * recharts/shadcn ChartContainer config for a per-platform series:
 * { posts: { label }, instagram: { label, color }, … }. X gets a light/dark
 * theme pair so it stays visible on a dark background.
 */
export function platformChartConfig(postsLabel = 'Posts') {
  return {
    posts: { label: postsLabel },
    ...Object.fromEntries(
      ENABLED_PLATFORMS.map((p) => [
        p.id,
        p.id === 'twitter'
          ? { label: p.label, theme: { light: '#000000', dark: '#cbd5e1' } }
          : { label: p.label, color: p.color },
      ]),
    ),
  }
}
