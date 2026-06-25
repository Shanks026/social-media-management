// Helpers for working with a note's `body`, which stores stringified Tiptap JSON.
// Legacy/empty values (plain text from the dialog era) are handled gracefully.

/**
 * Returns content suitable for Tiptap's `content` option.
 * - Valid Tiptap JSON doc  → the parsed object
 * - Legacy plain text/HTML → the raw string (Tiptap renders it)
 * - Empty                  → '' (empty editor)
 */
export function parseNoteBody(body) {
  if (!body) return ''
  try {
    const json = JSON.parse(body)
    if (json && typeof json === 'object') return json
  } catch {
    // not JSON — treat as legacy plain text/HTML
  }
  return body
}

/**
 * Extracts a plain-text excerpt from a note body for card previews.
 */
export function getNoteExcerpt(body, maxLen = 280) {
  if (!body) return ''
  let json
  try {
    json = JSON.parse(body)
  } catch {
    return String(body).slice(0, maxLen)
  }
  if (!json || typeof json !== 'object') return String(body).slice(0, maxLen)

  const parts = []
  const walk = (node) => {
    if (!node) return
    if (node.type === 'text' && node.text) parts.push(node.text)
    if (Array.isArray(node.content)) node.content.forEach(walk)
  }
  walk(json)
  return parts.join(' ').slice(0, maxLen)
}
