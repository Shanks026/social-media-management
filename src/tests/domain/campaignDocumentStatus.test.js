import { describe, it, expect } from 'vitest'
import * as campaign from '@/lib/domain/campaignStatus'
import * as document from '@/lib/domain/documentStatus'

describe('Campaign statuses', () => {
  it('lists the stored statuses and labels them in sentence case', () => {
    expect(campaign.STATUSES).toEqual(['ACTIVE', 'COMPLETED', 'ARCHIVED'])
    expect(campaign.statusLabel('ACTIVE')).toBe('Active')
    expect(campaign.statusLabel('COMPLETED')).toBe('Completed')
  })
})

describe('document statuses', () => {
  it('lists the stored statuses and labels them', () => {
    expect(document.STATUSES).toEqual(['ACTIVE', 'ARCHIVED'])
    expect(document.statusLabel('ARCHIVED')).toBe('Archived')
  })
})
