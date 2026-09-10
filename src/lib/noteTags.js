// Note tag color palette.
//
// Keys (e.g. 'blue') are what we store in note_tags.color — never a raw hex.
// The class strings below are STATIC so Tailwind's JIT compiler always sees them
// and never purges them from the production build. Do not build these class
// names dynamically (e.g. `bg-${color}-100`) — that would get stripped.

export const TAG_COLORS = {
  slate: {
    label: 'Slate',
    pill: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
    swatch: 'bg-slate-400',
  },
  red: {
    label: 'Red',
    pill: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900',
    dot: 'bg-red-500',
    swatch: 'bg-red-500',
  },
  orange: {
    label: 'Orange',
    pill: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900',
    dot: 'bg-orange-500',
    swatch: 'bg-orange-500',
  },
  amber: {
    label: 'Amber',
    pill: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900',
    dot: 'bg-amber-500',
    swatch: 'bg-amber-500',
  },
  green: {
    label: 'Green',
    pill: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900',
    dot: 'bg-green-500',
    swatch: 'bg-green-500',
  },
  teal: {
    label: 'Teal',
    pill: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-900',
    dot: 'bg-teal-500',
    swatch: 'bg-teal-500',
  },
  blue: {
    label: 'Blue',
    pill: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900',
    dot: 'bg-blue-500',
    swatch: 'bg-blue-500',
  },
  indigo: {
    label: 'Indigo',
    pill: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-900',
    dot: 'bg-indigo-500',
    swatch: 'bg-indigo-500',
  },
  violet: {
    label: 'Violet',
    pill: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-900',
    dot: 'bg-violet-500',
    swatch: 'bg-violet-500',
  },
  pink: {
    label: 'Pink',
    pill: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300 dark:border-pink-900',
    dot: 'bg-pink-500',
    swatch: 'bg-pink-500',
  },
  rose: {
    label: 'Rose',
    pill: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900',
    dot: 'bg-rose-500',
    swatch: 'bg-rose-500',
  },
  fuchsia: {
    label: 'Fuchsia',
    pill: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950 dark:text-fuchsia-300 dark:border-fuchsia-900',
    dot: 'bg-fuchsia-500',
    swatch: 'bg-fuchsia-500',
  },
  purple: {
    label: 'Purple',
    pill: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900',
    dot: 'bg-purple-500',
    swatch: 'bg-purple-500',
  },
  sky: {
    label: 'Sky',
    pill: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-900',
    dot: 'bg-sky-500',
    swatch: 'bg-sky-500',
  },
  cyan: {
    label: 'Cyan',
    pill: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-900',
    dot: 'bg-cyan-500',
    swatch: 'bg-cyan-500',
  },
  emerald: {
    label: 'Emerald',
    pill: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900',
    dot: 'bg-emerald-500',
    swatch: 'bg-emerald-500',
  },
  lime: {
    label: 'Lime',
    pill: 'bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-950 dark:text-lime-300 dark:border-lime-900',
    dot: 'bg-lime-500',
    swatch: 'bg-lime-500',
  },
  yellow: {
    label: 'Yellow',
    pill: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-900',
    dot: 'bg-yellow-500',
    swatch: 'bg-yellow-500',
  },
  stone: {
    label: 'Stone',
    pill: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700',
    dot: 'bg-stone-400',
    swatch: 'bg-stone-400',
  },
}

export const TAG_COLOR_KEYS = Object.keys(TAG_COLORS)

export function getTagColor(key) {
  return TAG_COLORS[key] ?? TAG_COLORS.slate
}

// Deterministic default color for a freshly created tag — spreads colors out
// as the workspace's tag count grows.
export function nextTagColor(existingCount = 0) {
  return TAG_COLOR_KEYS[existingCount % TAG_COLOR_KEYS.length]
}
