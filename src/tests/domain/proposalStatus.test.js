import { describe, it, expect } from 'vitest'
import { STATUSES, DISPLAY_STATUSES, EXPIRED, statusLabel, displayStatus } from '@/lib/domain/proposalStatus'

describe('Proposal statuses', () => {
  it('lists the seven stored statuses; Expired is display-only', () => {
    expect(STATUSES).toEqual([
      'DRAFT', 'SENT', 'VIEWED', 'CHANGES_REQUESTED', 'ACCEPTED', 'DECLINED', 'ARCHIVED',
    ])
    expect(STATUSES).not.toContain('EXPIRED')
    expect(DISPLAY_STATUSES).toEqual([
      'DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'CHANGES_REQUESTED', 'EXPIRED', 'ARCHIVED',
    ])
  })

  it('labels them', () => {
    expect(statusLabel('CHANGES_REQUESTED')).toBe('Changes Requested')
    expect(statusLabel(EXPIRED)).toBe('Expired')
  })
})

describe('displayStatus', () => {
  const today = new Date('2026-11-16T12:00:00')

  it('is Expired once an outstanding Proposal is past its valid-until date', () => {
    expect(displayStatus({ status: 'SENT', valid_until: '2026-11-15' }, today)).toBe('EXPIRED')
    expect(displayStatus({ status: 'VIEWED', valid_until: '2026-11-01' }, today)).toBe('EXPIRED')
    expect(displayStatus({ status: 'CHANGES_REQUESTED', valid_until: '2026-11-01' }, today)).toBe('EXPIRED')
  })

  it('is still valid on its last day', () => {
    expect(displayStatus({ status: 'SENT', valid_until: '2026-11-16' }, today)).toBe('SENT')
  })

  it('never expires a draft or a decided or archived Proposal', () => {
    for (const status of ['DRAFT', 'ACCEPTED', 'DECLINED', 'ARCHIVED']) {
      expect(displayStatus({ status, valid_until: '2020-01-01' }, today)).toBe(status)
    }
  })

  it('never expires without a valid-until date', () => {
    expect(displayStatus({ status: 'SENT', valid_until: null }, today)).toBe('SENT')
  })

  it('leaves a status the server already computed alone', () => {
    expect(displayStatus({ status: 'EXPIRED', valid_until: '2026-11-01' }, today)).toBe('EXPIRED')
  })
})
