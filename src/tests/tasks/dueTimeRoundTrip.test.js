// Must run in a non-UTC zone: the bug is invisible at UTC+0.
globalThis.process.env.TZ = 'Asia/Kolkata'

import { describe, it, expect } from 'vitest'
import { toDateTimeLocal, fromDateTimeLocal } from '@/lib/helper'

// Regression test for audit bug B11: EditTaskDialog seeded its
// <input type="datetime-local"> with the UTC wall time
// (toISOString().slice(0, 16)), and on save new Date(value) read that back as
// *local* time, so every save shifted due_at by the browser's UTC offset.

// Simulate one open-and-save of the Edit dialog without touching the field.
const saveUnchanged = (dueAt) => fromDateTimeLocal(toDateTimeLocal(dueAt))

describe('task due time round trip', () => {
  it('runs in a non-UTC zone', () => {
    expect(new Date('2026-11-08T00:00:00Z').getTimezoneOffset()).toBe(-330)
  })

  it('shows the due time in local wall-clock time', () => {
    // 09:30 UTC is 15:00 in India
    expect(toDateTimeLocal('2026-11-20T09:30:00.000Z')).toBe('2026-11-20T15:00')
  })

  it('keeps the due time unchanged across repeated saves', () => {
    const original = '2026-11-20T09:30:00.000Z'
    const once = saveUnchanged(original)
    const twice = saveUnchanged(once)
    const thrice = saveUnchanged(twice)
    expect([once, twice, thrice]).toEqual([original, original, original])
  })

  it('treats an empty field as no due date', () => {
    expect(toDateTimeLocal(null)).toBe('')
    expect(fromDateTimeLocal('')).toBeNull()
  })
})
