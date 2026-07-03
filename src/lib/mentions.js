/**
 * Split a comment body into plain-text and mention segments for rendering.
 *
 * @param {string} body   the raw comment text (may contain "@Full Name" tokens)
 * @param {string[]} names mention display strings to highlight, e.g. ["@Tanya Benedict"]
 * @returns {{ text: string, isMention: boolean }[]}
 *
 * Matching is longest-name-first so "@Ann Marie" wins over "@Ann". Only exact
 * "@Name" substrings starting at an '@' are highlighted; everything else is plain.
 */
export function splitMentions(body, names) {
  if (!body) return []
  const valid = (names || [])
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  if (valid.length === 0) return [{ text: body, isMention: false }]

  const segments = []
  let i = 0
  while (i < body.length) {
    let matched = null
    if (body[i] === '@') {
      for (const n of valid) {
        if (body.startsWith(n, i)) {
          matched = n
          break
        }
      }
    }
    if (matched) {
      segments.push({ text: matched, isMention: true })
      i += matched.length
    } else {
      let next = body.indexOf('@', i + 1)
      if (next === -1) next = body.length
      segments.push({ text: body.slice(i, next), isMention: false })
      i = next
    }
  }
  return segments
}
