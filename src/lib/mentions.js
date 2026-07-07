// Composer pending-mention chips — these are removable tokens, so they keep
// a pill background to read as a distinct chip (not inline text).
export const MENTION_CLASS = 'rounded bg-indigo-50 dark:bg-indigo-950 px-1 py-0.5 font-medium text-indigo-700 dark:text-indigo-400'
export const MY_MENTION_CLASS = 'rounded bg-rose-50 dark:bg-rose-950 px-1 py-0.5 font-medium text-rose-700 dark:text-rose-400'
// "@Important" chip — deliberately red, distinct from every other mention
// (regular and "@Everyone" both stay indigo/rose) so it reads as urgent.
export const IMPORTANT_MENTION_CLASS = 'rounded bg-red-50 dark:bg-red-950 px-1 py-0.5 font-medium text-red-700 dark:text-red-400'

// Inline mentions rendered within a posted comment/message body — no pill
// background, just colored text, so they read as part of the sentence.
// Mentions of the current logged-in user get a distinct rose highlight (Teams-style "@you").
export const MENTION_TEXT_CLASS = 'font-medium text-indigo-600 dark:text-indigo-400'
export const MY_MENTION_TEXT_CLASS = 'font-medium text-rose-600 dark:text-rose-400'
// Only used for other people's (neutral-bubble) messages — a solid red pill
// was tried to fix red-on-blue contrast on your own bubble, but it read as
// an error/alert badge clashing with the bubble rather than part of the
// sentence. Own-bubble messages instead reuse OWN_MENTION_CLASS (white,
// inherited from the bubble text) like every other token there — see the
// isOwn branch in ChatThread.jsx's MessageBody.
export const IMPORTANT_TEXT_CLASS = 'font-semibold text-red-600 dark:text-red-400'

/**
 * Returns { at, caret, query } if the caret sits inside an "@token" being
 * typed, else null. The '@' must be at the start or preceded by whitespace.
 *
 * @param {string} value the full composer text
 * @param {number} caret current cursor position within value
 */
export function detectMention(value, caret) {
  const upto = value.slice(0, caret)
  const at = upto.lastIndexOf('@')
  if (at === -1) return null
  const before = at === 0 ? '' : upto[at - 1]
  if (before && !/\s/.test(before)) return null
  const query = upto.slice(at + 1)
  if (/\s/.test(query)) return null
  return { at, caret, query }
}

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
