// System-role display palette (Owner / Admin / Member badges on member rows)
export const SYSTEM_ROLE_PALETTE = {
  owner:      { badge: 'border-0 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300', dot: 'bg-violet-500', label: 'Owner' },
  admin:      { badge: 'border-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',         dot: 'bg-blue-500',   label: 'Admin' },
  member:     { badge: 'border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', dot: 'bg-emerald-500', label: 'Member' },
  superadmin: { badge: 'border-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',     dot: 'bg-amber-500',  label: 'Superadmin' },
}

// Functional role colors — cosmetic badge only, never affects access
export const NAMED_ROLE_COLORS = {
  // Leadership
  'Founder':                   { badge: 'bg-violet-100 text-violet-600 dark:text-violet-400',   dot: 'bg-violet-500' },
  'Co-founder':                { badge: 'bg-purple-100 text-purple-600 dark:text-purple-400',   dot: 'bg-purple-500' },
  'CEO / Managing Director':   { badge: 'bg-fuchsia-100 text-fuchsia-600 dark:text-fuchsia-400', dot: 'bg-fuchsia-500' },
  // Client & Strategy
  'Account Manager':           { badge: 'bg-emerald-100 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'Project Manager':           { badge: 'bg-teal-100 text-teal-600 dark:text-teal-400',           dot: 'bg-teal-500' },
  'Strategist':                { badge: 'bg-indigo-100 text-indigo-600 dark:text-indigo-400',     dot: 'bg-indigo-500' },
  'Creative Director':         { badge: 'bg-purple-100 text-purple-600 dark:text-purple-400',   dot: 'bg-purple-500' },
  // Content & Creative
  'Social Media Manager':      { badge: 'bg-rose-100 text-rose-600 dark:text-rose-400',           dot: 'bg-rose-500' },
  'Content Creator':           { badge: 'bg-pink-100 text-pink-600 dark:text-pink-400',           dot: 'bg-pink-500' },
  'Designer':                  { badge: 'bg-violet-100 text-violet-600 dark:text-violet-400',   dot: 'bg-violet-500' },
  'Copywriter':                { badge: 'bg-sky-100 text-sky-600 dark:text-sky-400',               dot: 'bg-sky-500' },
  'Video Editor / Producer':   { badge: 'bg-amber-100 text-amber-600 dark:text-amber-400',       dot: 'bg-amber-500' },
  // Growth & Specialist
  'Marketing Specialist':      { badge: 'bg-blue-100 text-blue-600 dark:text-blue-400',           dot: 'bg-blue-500' },
  'Community Manager':         { badge: 'bg-pink-100 text-pink-600 dark:text-pink-400',           dot: 'bg-pink-500' },
  'SEO / Media Buyer':         { badge: 'bg-green-100 text-green-600 dark:text-green-400',         dot: 'bg-green-500' },
  'Developer':                 { badge: 'bg-cyan-100 text-cyan-600 dark:text-cyan-400',           dot: 'bg-cyan-500' },
  'Analyst':                   { badge: 'bg-slate-100 text-slate-600 dark:text-slate-400',         dot: 'bg-slate-500' },
  // Finance & Ops
  'Finance Manager':           { badge: 'bg-emerald-100 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'Operations Manager':        { badge: 'bg-orange-100 text-orange-600 dark:text-orange-400',   dot: 'bg-orange-500' },
}

// Grouped structure for InviteDialog select (with Custom free-text)
export const AGENCY_ROLE_GROUPS = [
  { label: 'Leadership',          roles: ['Founder', 'Co-founder', 'CEO / Managing Director'] },
  { label: 'Client & Strategy',   roles: ['Account Manager', 'Project Manager', 'Strategist', 'Creative Director'] },
  { label: 'Content & Creative',  roles: ['Social Media Manager', 'Content Creator', 'Designer', 'Copywriter', 'Video Editor / Producer'] },
  { label: 'Growth & Specialist', roles: ['Marketing Specialist', 'Community Manager', 'SEO / Media Buyer', 'Developer', 'Analyst'] },
  { label: 'Finance & Ops',       roles: ['Finance Manager', 'Operations Manager'] },
]

// Flat list derived from groups (for getRolePalette hash + backward compat)
export const AGENCY_ROLE_OPTIONS = AGENCY_ROLE_GROUPS.flatMap((g) => g.roles)

export const FALLBACK_PALETTE = [
  { badge: 'bg-blue-100 text-blue-600 dark:text-blue-400',          dot: 'bg-blue-500' },
  { badge: 'bg-emerald-100 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  { badge: 'bg-amber-100 text-amber-600 dark:text-amber-400',       dot: 'bg-amber-500' },
  { badge: 'bg-rose-100 text-rose-600 dark:text-rose-400',          dot: 'bg-rose-500' },
  { badge: 'bg-cyan-100 text-cyan-600 dark:text-cyan-400',          dot: 'bg-cyan-500' },
  { badge: 'bg-orange-100 text-orange-600 dark:text-orange-400',    dot: 'bg-orange-500' },
  { badge: 'bg-pink-100 text-pink-600 dark:text-pink-400',          dot: 'bg-pink-500' },
  { badge: 'bg-teal-100 text-teal-600 dark:text-teal-400',          dot: 'bg-teal-500' },
]

export const ADMIN_PALETTE   = { badge: 'bg-violet-100 text-violet-600 dark:text-violet-400', dot: 'bg-violet-500' }
export const REMOVED_PALETTE = { dot: 'bg-muted-foreground/50' }

export function getRolePalette(role) {
  if (!role) return null
  if (NAMED_ROLE_COLORS[role]) return NAMED_ROLE_COLORS[role]
  let hash = 0
  for (const ch of role) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length]
}
