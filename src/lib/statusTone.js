// Presentation for statuses: tone (colours) and icon, per entity (#77).
// Labels come from the entity's domain module (src/lib/domain/*), never from
// here. Tailwind needs literal class names, so every class below is spelled out.
import {
  Pencil,
  Send,
  MessageSquareWarning,
  ShieldCheck,
  Clock,
  CheckCircle2,
  CircleDashed,
  CalendarClock,
  PackageCheck,
  UploadCloud,
  Archive,
  PlayCircle,
  PauseCircle,
} from 'lucide-react'
import * as deliverable from '@/lib/domain/deliverableStatus'

// One entry per colour family. hex: charts and PDFs. badge: pill. dot: small
// round marker (version history). border: calendar cell edge. swatch: legend.
const TONES = {
  blue: { hex: '#3b82f6', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400', dot: 'bg-blue-500', border: 'border-l-blue-600', swatch: 'bg-blue-600' },
  amber: { hex: '#f59e0b', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400', dot: 'bg-amber-500', border: 'border-l-amber-600', swatch: 'bg-amber-600' },
  rose: { hex: '#f43f5e', badge: 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-400', dot: 'bg-rose-500', border: 'border-l-rose-600', swatch: 'bg-rose-600' },
  violet: { hex: '#8b5cf6', badge: 'bg-violet-100 text-violet-800 dark:bg-violet-500/10 dark:text-violet-400', dot: 'bg-violet-500', border: 'border-l-violet-600', swatch: 'bg-violet-600' },
  orange: { hex: '#f97316', badge: 'bg-orange-100 text-orange-800 dark:bg-orange-500/10 dark:text-orange-400', dot: 'bg-orange-500', border: 'border-l-orange-600', swatch: 'bg-orange-600' },
  green: { hex: '#22c55e', badge: 'bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400', dot: 'bg-green-500', border: 'border-l-green-600', swatch: 'bg-green-600' },
  pink: { hex: '#ec4899', badge: 'bg-pink-100 text-pink-800 dark:bg-pink-500/10 dark:text-pink-400', dot: 'bg-pink-500', border: 'border-l-pink-600', swatch: 'bg-pink-600' },
  purple: { hex: '#a855f7', badge: 'bg-purple-100 text-purple-800 dark:bg-purple-500/10 dark:text-purple-400', dot: 'bg-purple-500', border: 'border-l-purple-600', swatch: 'bg-purple-600' },
  teal: { hex: '#14b8a6', badge: 'bg-teal-100 text-teal-800 dark:bg-teal-500/10 dark:text-teal-400', dot: 'bg-teal-500', border: 'border-l-teal-600', swatch: 'bg-teal-600' },
  lime: { hex: '#84cc16', badge: 'bg-lime-100 text-lime-800 dark:bg-lime-500/10 dark:text-lime-400', dot: 'bg-lime-500', border: 'border-l-lime-600', swatch: 'bg-lime-600' },
  emerald: { hex: '#10b981', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400', dot: 'bg-emerald-500', border: 'border-l-emerald-600', swatch: 'bg-emerald-600' },
  sky: { hex: '#0ea5e9', badge: 'bg-sky-100 text-sky-800 dark:bg-sky-500/10 dark:text-sky-400', dot: 'bg-sky-500', border: 'border-l-sky-600', swatch: 'bg-sky-600' },
  cyan: { hex: '#06b6d4', badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-400', dot: 'bg-cyan-500', border: 'border-l-cyan-600', swatch: 'bg-cyan-600' },
  slate: { hex: '#94a3b8', badge: 'bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-400', dot: 'bg-slate-400', border: 'border-l-slate-500', swatch: 'bg-slate-500' },
}

const t = (tone, icon, extra) => ({ ...TONES[tone], tone, icon, ...extra })

const BY_ENTITY = {
  deliverable: {
    DRAFT: t('blue', Pencil),
    SUBMITTED: t('amber', Send),
    CHANGES_REQUESTED: t('rose', MessageSquareWarning, { pulse: true }),
    READY: t('violet', ShieldCheck),
    PENDING_APPROVAL: t('orange', Clock),
    APPROVED: t('green', CheckCircle2),
    NEEDS_REVISION: t('pink', CircleDashed, { pulse: true }),
    SCHEDULED: t('purple', CalendarClock),
    DELIVERED: t('teal', PackageCheck),
    PARTIALLY_PUBLISHED: t('lime', UploadCloud),
    PUBLISHED: t('emerald', UploadCloud),
    ARCHIVED: t('slate', Archive),
  },
  client: {
    ACTIVE: t('green', PlayCircle),
    PAUSED: t('amber', PauseCircle),
    ARCHIVED: t('slate', Archive),
  },
  invoice: {
    DRAFT: t('blue'),
    SENT: t('sky', UploadCloud),
    PAID: t('emerald'),
    OVERDUE: t('rose'),
    VOID: t('slate'),
  },
  transaction: {
    PAID: t('emerald'),
    PENDING: t('amber'),
    OVERDUE: t('rose'),
  },
  cadence: {
    MONTHLY: t('cyan'),
    QUARTERLY: t('teal'),
    YEARLY: t('violet'),
  },
}

const FALLBACK = t('slate')

/** Tone and icon for a status of an entity; a neutral slate tone if unknown. */
export function statusTone(entity, status) {
  return BY_ENTITY[entity]?.[status] ?? FALLBACK
}

// ── Deliverable charts ────────────────────────────────────────────────────
// Stored + derived statuses in render order; ARCHIVED is left out of charts.
export const CHART_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'CHANGES_REQUESTED',
  'READY',
  'PENDING_APPROVAL',
  'APPROVED',
  'NEEDS_REVISION',
  'SCHEDULED',
  'DELIVERED',
  deliverable.PARTIALLY_PUBLISHED,
  'PUBLISHED',
]

// Charts key their series by display name with spaces (PENDING_APPROVAL → 'PENDING APPROVAL').
const chartName = (key) => key.replace(/_/g, ' ')

/** Stored status → chart series name. */
export const STATUS_DISPLAY_MAP = Object.fromEntries(
  CHART_STATUSES.map((k) => [k, chartName(k)]),
)

/** Chart series names, in render order. */
export const ALLOWED_CHART_STATUSES = CHART_STATUSES.map(chartName)

/** recharts/shadcn ChartContainer config keyed by series name. */
export const DELIVERABLE_CHART_CONFIG = Object.fromEntries(
  CHART_STATUSES.map((k) => [
    chartName(k),
    { label: deliverable.statusLabel(k), color: statusTone('deliverable', k).hex },
  ]),
)
