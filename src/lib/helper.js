import { createElement } from 'react'
import { displayStatus } from '@/lib/domain/deliverableStatus'

/**
 * Maximum file size allowed for document uploads (50 MB).
 * Change this constant to update the limit across the entire app.
 */
export const MAX_DOCUMENT_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

/**
 * @deprecated Use displayStatus from @/lib/domain/deliverableStatus (#142).
 * Kept as a re-export until the E4 contract ticket removes helper.js.
 */
export { displayStatus as getPublishState } from '@/lib/domain/deliverableStatus'

/**
 * Status-filter predicate that agrees with what the calendar cells show:
 * compares the derived publish state, not the raw DB status (B9).
 */
export function matchesPublishStatus(version, statusFilter) {
  return statusFilter === 'all' || displayStatus(version) === statusFilter
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

