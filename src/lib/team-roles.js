// Intentional color assignments for every common agency/media role.
// Add new entries here — TeamPage and ProfileSettings both pull from this map.
export const NAMED_ROLE_COLORS = {
  'Designer':             { badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',   dot: 'bg-violet-500' },
  'Creative Director':    { badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',   dot: 'bg-purple-500' },
  'Art Director':         { badge: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400', dot: 'bg-fuchsia-500' },
  'Copywriter':           { badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',             dot: 'bg-sky-500' },
  'Content Creator':      { badge: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',          dot: 'bg-pink-500' },
  'Social Media Manager': { badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',          dot: 'bg-rose-500' },
  'Photographer':         { badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',    dot: 'bg-orange-500' },
  'Video Editor':         { badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',       dot: 'bg-amber-500' },
  'Animator':             { badge: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',    dot: 'bg-yellow-500' },
  'Motion Designer':      { badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',    dot: 'bg-orange-500' },
  'UX Designer':          { badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',   dot: 'bg-violet-500' },
  'Developer':            { badge: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',          dot: 'bg-cyan-500' },
  'Account Manager':      { badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'Project Manager':      { badge: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',          dot: 'bg-teal-500' },
  'Strategist':           { badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',    dot: 'bg-indigo-500' },
  'Brand Manager':        { badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',   dot: 'bg-violet-500' },
  'SEO Specialist':       { badge: 'bg-green-500/10 text-green-600 dark:text-green-400',       dot: 'bg-green-500' },
  'Media Buyer':          { badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',       dot: 'bg-amber-500' },
  'PR Manager':           { badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',          dot: 'bg-blue-500' },
  'Marketing Manager':    { badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',          dot: 'bg-blue-500' },
  'Community Manager':    { badge: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',          dot: 'bg-pink-500' },
  'Influencer Manager':   { badge: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400', dot: 'bg-fuchsia-500' },
  'Analyst':              { badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',       dot: 'bg-slate-500' },
  'Finance Manager':      { badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
}

// All role names, in display order, for Select options.
export const AGENCY_ROLE_OPTIONS = Object.keys(NAMED_ROLE_COLORS)

// Fallback for unknown/custom roles — hash-assigned.
export const FALLBACK_PALETTE = [
  { badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',          dot: 'bg-blue-500' },
  { badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  { badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',       dot: 'bg-amber-500' },
  { badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',          dot: 'bg-rose-500' },
  { badge: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',          dot: 'bg-cyan-500' },
  { badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',    dot: 'bg-orange-500' },
  { badge: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',          dot: 'bg-pink-500' },
  { badge: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',          dot: 'bg-teal-500' },
]

export const ADMIN_PALETTE   = { badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', dot: 'bg-violet-500' }
export const REMOVED_PALETTE = { dot: 'bg-muted-foreground/50' }

export function getRolePalette(role) {
  if (!role) return null
  if (NAMED_ROLE_COLORS[role]) return NAMED_ROLE_COLORS[role]
  let hash = 0
  for (const ch of role) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length]
}
