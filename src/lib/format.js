// Formatting for the whole app: currency, dates, sizes, initials (#77, #149).
// Pure functions, no React. The signatures leave room for E8's workspace
// locale setting: the locale and currency come from CURRENCY in one place.
import { format as formatWith, isValid, parseISO } from 'date-fns'

export const CURRENCY = {
  CODE: 'INR',
  LOCALE: 'en-IN',
  SYMBOL: '₹',
}

const EMPTY = '—'

const toNumber = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * Money as text. `decimals` fixes the fraction digits (0 by default, 2 for
 * invoice editing). `display: 'code'` renders "INR 1,234" for PDFs, where the
 * rupee glyph can render blank. null, undefined and NaN count as 0.
 */
export function formatCurrency(amount, { decimals = 0, display = 'symbol' } = {}) {
  return new Intl.NumberFormat(CURRENCY.LOCALE, {
    style: 'currency',
    currency: CURRENCY.CODE,
    currencyDisplay: display,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(toNumber(amount))
}

/** Indian compact money for stat tiles: ₹950, ₹2K, ₹2.5L, ₹2.5Cr. */
export function formatCompactCurrency(amount) {
  const n = toNumber(amount)
  const { SYMBOL } = CURRENCY
  if (n >= 10000000) return `${SYMBOL}${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000) return `${SYMBOL}${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `${SYMBOL}${(n / 1000).toFixed(0)}K`
  return `${SYMBOL}${n.toFixed(0)}`
}

/**
 * Compact currency label for chart axes: whole rupees below 1,000, then a
 * trimmed "k" (₹0, ₹750, ₹1.5k, ₹120k). Avoids "₹0.001k" on small or empty
 * data (B8).
 */
export function formatAxisCurrency(value, symbol = CURRENCY.SYMBOL) {
  const n = toNumber(value)
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs < 1000) return `${sign}${symbol}${Math.round(abs)}`
  const k = Math.round((abs / 1000) * 10) / 10
  return `${sign}${symbol}${k}k`
}

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : typeof value === 'string' ? parseISO(value) : new Date(value)
  return isValid(date) ? date : null
}

// Compact relative time — "just now", "5m ago", "3h ago", "2d ago" — instead
// of date-fns's verbose "about 3 hours ago", which collides with long names
// in narrow panels (comment threads, chat messages).
function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 45) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

const PATTERNS = { short: 'd MMM yyyy', long: 'd MMMM yyyy' }

/**
 * A date as text, by named style:
 *   short    5 Nov 2026 (default)        long      5 November 2026
 *   range    pass { start, end }: "5 Nov 2026 – 1 Dec 2026", "From …", "Until …"
 *   relative time ago: "just now", "5m ago", "2d ago"
 * Empty or invalid values give "—".
 */
export function formatDate(value, style = 'short') {
  if (style === 'range') {
    const start = toDate(value?.start)
    const end = toDate(value?.end)
    if (start && end) return `${formatDate(start)} – ${formatDate(end)}`
    if (start) return `From ${formatDate(start)}`
    if (end) return `Until ${formatDate(end)}`
    return EMPTY
  }
  const date = toDate(value)
  if (!date) return EMPTY
  if (style === 'relative') return timeAgo(date)
  return formatWith(date, PATTERNS[style] ?? PATTERNS.short)
}

/** 2457600 → "2.3 MB" */
export function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value % 1 === 0 ? value : value.toFixed(1)} ${units[i]}`
}

/**
 * ISO timestamp -> value for <input type="datetime-local"> (local wall-clock
 * "yyyy-MM-ddTHH:mm"). Paired with fromDateTimeLocal so an unchanged field
 * saves back the same instant (B11).
 */
export function toDateTimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** <input type="datetime-local"> value (local time) -> ISO timestamp, or null. */
export function fromDateTimeLocal(value) {
  return value ? new Date(value).toISOString() : null
}

/**
 * Up to `max` capital initials from a name; falls back to the email's local
 * part, then "?".
 */
export function initials(name, { email, max = 2 } = {}) {
  const source = (name || '').trim() || (email || '').split('@')[0].trim()
  const words = source.split(/[\s._-]+/).filter(Boolean)
  if (!words.length) return '?'
  return words
    .slice(0, max)
    .map((w) => w[0].toUpperCase())
    .join('')
}
