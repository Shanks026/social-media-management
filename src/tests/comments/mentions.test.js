import { describe, it, expect } from 'vitest'
import { splitMentions } from '@/lib/mentions'

describe('splitMentions', () => {
  it('returns empty array for empty body', () => {
    expect(splitMentions('', ['@Tanya Benedict'])).toEqual([])
  })

  it('returns a single plain segment when there are no names', () => {
    expect(splitMentions('hello world', [])).toEqual([
      { text: 'hello world', isMention: false },
    ])
  })

  it('highlights a single mention embedded in text', () => {
    const segs = splitMentions('hey @Tanya Benedict please review', ['@Tanya Benedict'])
    expect(segs).toEqual([
      { text: 'hey ', isMention: false },
      { text: '@Tanya Benedict', isMention: true },
      { text: ' please review', isMention: false },
    ])
  })

  it('handles multiple distinct mentions', () => {
    const segs = splitMentions('@Ann Marie and @Bob Lee', ['@Ann Marie', '@Bob Lee'])
    expect(segs.filter((s) => s.isMention).map((s) => s.text)).toEqual([
      '@Ann Marie',
      '@Bob Lee',
    ])
  })

  it('prefers the longest matching name (no partial shadowing)', () => {
    const segs = splitMentions('ping @Ann Marie now', ['@Ann', '@Ann Marie'])
    const mention = segs.find((s) => s.isMention)
    expect(mention.text).toBe('@Ann Marie')
  })

  it('does not highlight an @ that is not a known name', () => {
    const segs = splitMentions('email me @ home', ['@Tanya Benedict'])
    expect(segs.every((s) => !s.isMention)).toBe(true)
  })

  it('reconstructs the original body from all segments', () => {
    const body = 'hi @Bob Lee, cc @Ann Marie ok'
    const segs = splitMentions(body, ['@Bob Lee', '@Ann Marie'])
    expect(segs.map((s) => s.text).join('')).toBe(body)
  })
})
