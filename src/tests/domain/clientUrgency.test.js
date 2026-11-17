import { describe, it, expect } from 'vitest'
import {
  URGENCIES,
  urgencyOf,
  urgencyLabel,
  isNeedsAttention,
} from '@/lib/domain/clientStatus'

const NOW = new Date('2026-11-17T12:00:00Z')
const inHours = (h) => new Date(NOW.getTime() + h * 3600_000).toISOString()

describe('urgencyOf', () => {
  it('has no urgency without a date', () => {
    expect(urgencyOf(null, NOW)).toBeNull()
    expect(urgencyOf(undefined, NOW)).toBeNull()
  })

  it('is OVERDUE once the date has passed', () => {
    expect(urgencyOf(inHours(-0.1), NOW)).toMatchObject({ key: 'OVERDUE', label: 'Overdue', pulse: true })
  })

  it('is URGENT under 24h, including the boundary below it', () => {
    expect(urgencyOf(inHours(0), NOW).key).toBe('URGENT')
    expect(urgencyOf(inHours(23.9), NOW)).toMatchObject({ key: 'URGENT', label: 'Urgent', pulse: true })
  })

  it('is WARNING from 24h up to 48h', () => {
    expect(urgencyOf(inHours(24), NOW)).toMatchObject({ key: 'WARNING', label: 'Warning', pulse: false })
    expect(urgencyOf(inHours(47.9), NOW).key).toBe('WARNING')
  })

  it('is HEALTHY from 48h, with no label', () => {
    expect(urgencyOf(inHours(48), NOW)).toMatchObject({ key: 'HEALTHY', label: null, pulse: false })
  })
})

describe('urgency keys', () => {
  it('lists the keys most to least pressing', () => {
    expect(URGENCIES).toEqual(['OVERDUE', 'URGENT', 'WARNING', 'HEALTHY'])
  })

  it('labels a key, and is blank for none', () => {
    expect(urgencyLabel('URGENT')).toBe('Urgent')
    expect(urgencyLabel('HEALTHY')).toBe('')
    expect(urgencyLabel(null)).toBe('')
  })

  it('groups OVERDUE and URGENT as needing attention', () => {
    expect(isNeedsAttention('OVERDUE')).toBe(true)
    expect(isNeedsAttention('URGENT')).toBe(true)
    expect(isNeedsAttention('WARNING')).toBe(false)
    expect(isNeedsAttention('HEALTHY')).toBe(false)
    expect(isNeedsAttention(undefined)).toBe(false)
  })
})
