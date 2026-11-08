import { createElement } from 'react'

/**
 * Maximum file size allowed for document uploads (50 MB).
 * Change this constant to update the limit across the entire app.
 */
export const MAX_DOCUMENT_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

/**
 * Compact relative time — "just now", "5m ago", "3h ago", "2d ago" — instead
 * of date-fns's verbose "about 3 hours ago", which collides with long names
 * in narrow panels (comment threads, chat messages).
 */
export function formatCompactTimeAgo(dateInput) {
  const seconds = Math.floor((Date.now() - new Date(dateInput).getTime()) / 1000)
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

/**
 * Format a byte count into a human-readable size string.
 * e.g. 2457600 → "2.3 MB"
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value % 1 === 0 ? value : value.toFixed(1)} ${units[i]}`
}

/**
 * Derives a display-level publish state from a post version.
 * Returns the DB status for single-date posts.
 * Returns 'PARTIALLY_PUBLISHED' (UI-only) when some but not all platforms are published.
 */
export function getPublishState(version) {
  if (!version?.platform_schedules) return version?.status
  const entries = Object.values(version.platform_schedules)
  if (!entries.length) return version.status
  const publishedCount = entries.filter((e) => e.published_at).length
  if (publishedCount === 0) return version.status
  if (publishedCount === entries.length) return 'PUBLISHED'
  return 'PARTIALLY_PUBLISHED'
}

/**
 * Status-filter predicate that agrees with what the calendar cells show:
 * compares the derived publish state, not the raw DB status (B9).
 */
export function matchesPublishStatus(version, statusFilter) {
  return statusFilter === 'all' || getPublishState(version) === statusFilter
}

/**
 * Renders a post caption with hashtags highlighted in blue.
 * Returns an array of strings and React elements suitable for rendering.
 */
export function renderCaption(text) {
  if (!text) return 'No description provided.'
  return text.split(/(#\w+)/g).map((part, i) =>
    part.startsWith('#')
      ? createElement('span', { key: i, className: 'text-blue-500' }, part)
      : part
  )
}

const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.zip', '.txt', '.fig', '.sketch', '.ai', '.eps']
const OFFICE_EXTENSIONS = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx']

export function isDocumentUrl(url) {
  if (!url || typeof url !== 'string') return false
  const lower = url.toLowerCase().split('?')[0]
  return DOCUMENT_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function getDocumentExtension(url) {
  if (!url) return 'FILE'
  const lower = url.toLowerCase().split('?')[0]
  const ext = DOCUMENT_EXTENSIONS.find((e) => lower.endsWith(e))
  return ext ? ext.replace('.', '').toUpperCase() : 'FILE'
}

export function getDocumentPreviewUrl(url) {
  if (!url) return null
  const ext = getDocumentExtension(url).toLowerCase()
  if (ext === 'pdf') return url
  if (OFFICE_EXTENSIONS.includes(ext))
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`
  return null
}

/**
 * Format a date string into: 2 Jan, 2026
 */
export function formatDate(dateInput) {
    if (!dateInput) return "";

    const date = new Date(dateInput);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

/**
 * Compact currency label for chart axes: whole rupees below 1,000, then a
 * trimmed "k" (₹0, ₹750, ₹1.5k, ₹120k). Avoids "₹0.001k" on small or empty
 * data (B8).
 */
export function formatAxisCurrency(value, symbol = '₹') {
  const n = Number(value) || 0
  const abs = Math.abs(n)
  if (abs < 1000) return `${n < 0 ? '-' : ''}${symbol}${Math.round(abs)}`
  const k = Math.round((abs / 1000) * 10) / 10
  return `${n < 0 ? '-' : ''}${symbol}${k}k`
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
