import { describe, it, expect } from 'vitest'
import { formatAxisCurrency } from '@/lib/helper'

// B8: the finance chart's y-axis read "₹0.001k" on empty data.
describe('formatAxisCurrency', () => {
  it('shows whole rupees below 1,000 instead of fractional k', () => {
    expect(formatAxisCurrency(0)).toBe('₹0')
    expect(formatAxisCurrency(1)).toBe('₹1')
    expect(formatAxisCurrency(250)).toBe('₹250')
  })

  it('switches to a trimmed k from 1,000', () => {
    expect(formatAxisCurrency(1000)).toBe('₹1k')
    expect(formatAxisCurrency(1500)).toBe('₹1.5k')
    expect(formatAxisCurrency(120000)).toBe('₹120k')
  })

  it('uses the given symbol', () => {
    expect(formatAxisCurrency(2000, '$')).toBe('$2k')
  })
})
