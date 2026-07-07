/**
 * Returns { at, caret, query } if the caret sits inside a "/token" being
 * typed, else null. The '/' must be at the start or preceded by whitespace.
 * Mirrors detectMention() in mentions.js — same grammar, different trigger.
 *
 * @param {string} value the full composer text
 * @param {number} caret current cursor position within value
 */
export function detectSlashCommand(value, caret) {
  const upto = value.slice(0, caret)
  const at = upto.lastIndexOf('/')
  if (at === -1) return null
  const before = at === 0 ? '' : upto[at - 1]
  if (before && !/\s/.test(before)) return null
  const query = upto.slice(at + 1)
  if (/\s/.test(query)) return null
  return { at, caret, query }
}

/**
 * Split a chat message body into plain-text and reference segments for
 * rendering. Mirrors splitMentions() in mentions.js, but matches "[[Title]]"
 * spans instead of "@Name" — a bracketed delimiter is required because a
 * deliverable/task title (e.g. "Follow up") isn't a safe match boundary on
 * its own the way an "@"-prefixed name is.
 *
 * @param {string} body raw message text (may contain "[[Title]]" tokens)
 * @param {{type: string, id: string, title: string, client_id: string|null}[]} references
 * @returns {{ text: string, isReference: boolean, reference?: object }[]}
 */
export function splitReferences(body, references) {
  if (!body) return []
  const valid = (references || []).filter(Boolean)
  if (valid.length === 0) return [{ text: body, isReference: false }]

  const segments = []
  let i = 0
  while (i < body.length) {
    if (body[i] === '[' && body[i + 1] === '[') {
      const end = body.indexOf(']]', i + 2)
      if (end !== -1) {
        const title = body.slice(i + 2, end)
        const reference = valid.find((r) => r.title === title)
        if (reference) {
          segments.push({ text: title, isReference: true, reference })
          i = end + 2
          continue
        }
      }
    }
    let next = body.indexOf('[[', i + 1)
    if (next === -1) next = body.length
    segments.push({ text: body.slice(i, next), isReference: false })
    i = next
  }
  return segments
}
