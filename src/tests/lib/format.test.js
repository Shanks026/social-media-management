import { describe, it, expect } from 'vitest'
import {
  CURRENCY,
  formatCurrency,
  formatCompactCurrency,
  formatAxisCurrency,
  formatDate,
  formatFileSize,
  toDateTimeLocal,
  fromDateTimeLocal,
  initials,
} from '@/lib/format'

// Intl uses a non-breaking space between the symbol/code and the number.
const norm = (s) => s.replace(/\s/g, ' ')

describe('CURRENCY', () => {
  it('is INR with the en-IN locale', () => {
    expect(CURRENCY).toEqual({ CODE: 'INR', LOCALE: 'en-IN', SYMBOL: '₹' })
  })
})

describe('formatCurrency', () => {
  it('uses the symbol and no decimals by default', () => {
    expect(norm(formatCurrency(1234567))).toBe('₹12,34,567')
  })

  it('rounds to the requested decimals', () => {
    expect(norm(formatCurrency(1200, { decimals: 2 }))).toBe('₹1,200.00')
    expect(norm(formatCurrency(1200.5, { decimals: 2 }))).toBe('₹1,200.50')
  })

  it('can show the ISO code for PDFs', () => {
    expect(norm(formatCurrency(1234, { display: 'code' }))).toBe('INR 1,234')
  })

  it('treats null, undefined and NaN as 0', () => {
    expect(norm(formatCurrency(null))).toBe('₹0')
    expect(norm(formatCurrency(undefined))).toBe('₹0')
    expect(norm(formatCurrency(Number.NaN))).toBe('₹0')
  })

  it('accepts numeric strings', () => {
    expect(norm(formatCurrency('2500'))).toBe('₹2,500')
  })
})

describe('formatCompactCurrency', () => {
  it('uses K, L and Cr', () => {
    expect(formatCompactCurrency(950)).toBe('₹950')
    expect(formatCompactCurrency(1500)).toBe('₹2K')
    expect(formatCompactCurrency(250000)).toBe('₹2.5L')
    expect(formatCompactCurrency(25000000)).toBe('₹2.5Cr')
  })
})

describe('formatAxisCurrency', () => {
  it('trims to whole rupees then k', () => {
    expect(formatAxisCurrency(0)).toBe('₹0')
    expect(formatAxisCurrency(750)).toBe('₹750')
    expect(formatAxisCurrency(1500)).toBe('₹1.5k')
    expect(formatAxisCurrency(-120000)).toBe('-₹120k')
    expect(formatAxisCurrency(null)).toBe('₹0')
  })
})

describe('formatDate', () => {
  const d = '2026-11-05T10:00:00'

  it('short: day month year', () => {
    expect(formatDate(d)).toBe('5 Nov 2026')
    expect(formatDate(d, 'short')).toBe('5 Nov 2026')
  })

  it('long: full month name', () => {
    expect(formatDate(d, 'long')).toBe('5 November 2026')
  })

  it('accepts Date objects', () => {
    expect(formatDate(new Date(2026, 10, 5), 'short')).toBe('5 Nov 2026')
  })

  it('returns a dash for empty or invalid values', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined, 'long')).toBe('—')
    expect(formatDate('', 'short')).toBe('—')
    expect(formatDate('not a date')).toBe('—')
  })

  it('range: both, one side, or none', () => {
    expect(formatDate({ start: '2026-11-05', end: '2026-12-01' }, 'range')).toBe(
      '5 Nov 2026 – 1 Dec 2026',
    )
    expect(formatDate({ start: '2026-11-05' }, 'range')).toBe('From 5 Nov 2026')
    expect(formatDate({ end: '2026-12-01' }, 'range')).toBe('Until 1 Dec 2026')
    expect(formatDate({}, 'range')).toBe('—')
    expect(formatDate(null, 'range')).toBe('—')
  })

  it('relative: compact time ago', () => {
    const ago = (ms) => new Date(Date.now() - ms).toISOString()
    expect(formatDate(ago(5_000), 'relative')).toBe('just now')
    expect(formatDate(ago(5 * 60_000), 'relative')).toBe('5m ago')
    expect(formatDate(ago(3 * 3_600_000), 'relative')).toBe('3h ago')
    expect(formatDate(ago(2 * 86_400_000), 'relative')).toBe('2d ago')
    expect(formatDate(null, 'relative')).toBe('—')
  })

  it('falls back to short for an unknown style', () => {
    expect(formatDate(d, 'nope')).toBe('5 Nov 2026')
  })
})

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(null)).toBe('0 B')
    expect(formatFileSize(2457600)).toBe('2.3 MB')
    expect(formatFileSize(1024)).toBe('1 KB')
  })
})

describe('datetime-local pair', () => {
  it('round-trips an instant', () => {
    const iso = '2026-11-05T10:30:00.000Z'
    expect(fromDateTimeLocal(toDateTimeLocal(iso))).toBe(iso)
  })

  it('handles empty', () => {
    expect(toDateTimeLocal(null)).toBe('')
    expect(fromDateTimeLocal('')).toBeNull()
  })
})

describe('initials', () => {
  it('takes the first letters of up to two words', () => {
    expect(initials('Olivia Owner')).toBe('OO')
    expect(initials('olivia')).toBe('O')
    expect(initials('Mary Jane Watson')).toBe('MJ')
  })

  it('ignores extra whitespace', () => {
    expect(initials('  Adam   Admin  ')).toBe('AA')
  })

  it('respects max', () => {
    expect(initials('Mary Jane Watson', { max: 3 })).toBe('MJW')
    expect(initials('Mary Jane', { max: 1 })).toBe('M')
  })

  it('falls back to the email local part, then ?', () => {
    expect(initials('', { email: 'zed@example.com' })).toBe('Z')
    expect(initials(null, { email: 'jo.smith@example.com' })).toBe('JS')
    expect(initials('', {})).toBe('?')
    expect(initials(undefined)).toBe('?')
  })
})
