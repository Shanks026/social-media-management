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
