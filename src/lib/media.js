// Media and file helpers: pure, no JSX. Used wherever a deliverable or a
// client document shows an attachment.

/**
 * Maximum file size allowed for document uploads (50 MB).
 * Change this constant to update the limit across the entire app.
 */
export const MAX_DOCUMENT_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.zip', '.txt', '.fig', '.sketch', '.ai', '.eps']
const OFFICE_EXTENSIONS = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx']

/** Whether a media URL points at a document rather than an image or video. */
export function isDocumentUrl(url) {
  if (!url || typeof url !== 'string') return false
  const lower = url.toLowerCase().split('?')[0]
  return DOCUMENT_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/** The document's extension in capitals ('PDF'), or 'FILE'. */
export function getDocumentExtension(url) {
  if (!url) return 'FILE'
  const lower = url.toLowerCase().split('?')[0]
  const ext = DOCUMENT_EXTENSIONS.find((e) => lower.endsWith(e))
  return ext ? ext.replace('.', '').toUpperCase() : 'FILE'
}

/** A URL that previews the document in the browser, or null if none can. */
export function getDocumentPreviewUrl(url) {
  if (!url) return null
  const ext = getDocumentExtension(url).toLowerCase()
  if (ext === 'pdf') return url
  if (OFFICE_EXTENSIONS.includes(ext))
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`
  return null
}
