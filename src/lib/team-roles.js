// System-role display palette (Owner / Admin / Member badges on member rows).
//
// This file used to also carry the job-title palette (NAMED_ROLE_COLORS), a
// hash-based FALLBACK_PALETTE for custom titles, getRolePalette(), and the
// hardcoded AGENCY_ROLE_GROUPS / AGENCY_ROLE_OPTIONS list. All of that was
// retired by feature 10: job titles are now owner-defined rows in
// `agency_job_roles`, each carrying its own color key, so a title's color is
// chosen rather than derived from a hash of its name. See `src/lib/job-roles.js`.
//
// System roles stay hardcoded on purpose — owner/admin/member is the access
// model, not a list anyone can edit.
// `name` is the Discord-style author-name color used in conversational
// surfaces (chat + comment threads) — a text-on-page color, so it can't
// reuse `badge`, whose text tones are picked to sit on a tinted chip.
//
// The four hues are not free choices. Chat and comments already spend color:
// indigo = @mentions of others (and the deep-link highlight background),
// rose = a mention of *you*, red = @Important, blue = entity-reference links
// and `--primary`. A role tone in any of those families reads as the wrong
// thing — an admin in blue looks like a hyperlink sitting next to real ones.
//
// Superadmin is amber, and is the one role at -800 rather than -700 in light
// mode. Warm hues carry the least luminance headroom of any family here:
// amber-700 measures 4.52:1 and yellow-700 actually fails at 4.40:1, so -800
// is the first amber step with real margin (6.38:1). It is also the rarest
// role — in practice never rendered — so breaking the uniform step costs
// nothing visually.
//
// Light tones are otherwise -700, that being the LIGHTEST step of those hues
// still clearing WCAG AA (4.5:1) for normal text on every surface a name can
// land on: the white page, the muted background, and the indigo highlight a
// deep-linked comment flashes — the last being darkest, so it sets the floor.
// -700 is that floor, not a preference; at -600 these hues measure 3.2–4.2:1.
// Measured worst case across the set is emerald at 4.80:1.
//
// Dark tones are -400. On a dark page lighter means MORE contrast, so there
// is headroom here that light mode does not have; the set runs 5.42–8.80:1.
//
// Member is emerald rather than green because green carries less luminance
// per unit of chroma: green-700 lands at 4.42:1, under the floor, which would
// force member alone down to green-800 and leave it visibly darker than the
// other three. Emerald-700 reads as the same kind of green at 4.80:1.
//
// One caveat before touching owner: pink-700/400 is the closest any role tone
// comes to an already-spoken-for hue — ΔE 0.051 from the rose that marks a
// mention of *you*, only 13° of hue apart. They sit in different places (role
// tint on the author name, rose inline in the body), but a message where the
// owner mentions you puts both on screen at once. Moving owner toward fuchsia
// (hue 324 vs pink's 4) widens the gap if that ever reads wrong in practice.
export const SYSTEM_ROLE_PALETTE = {
  owner:      { badge: 'border-0 bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',   dot: 'bg-pink-500',  name: 'text-pink-700 dark:text-pink-400',   label: 'Owner' },
  admin:      { badge: 'border-0 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',   dot: 'bg-purple-500',  name: 'text-purple-700 dark:text-purple-400',   label: 'Admin' },
  member:     { badge: 'border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', dot: 'bg-emerald-500', name: 'text-emerald-700 dark:text-emerald-400', label: 'Member' },
  superadmin: { badge: 'border-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',       dot: 'bg-amber-500',   name: 'text-amber-800 dark:text-amber-400',     label: 'Superadmin' },
}
