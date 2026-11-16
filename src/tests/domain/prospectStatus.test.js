import { describe, it, expect } from 'vitest'
import { STATUSES, STAGES_BEFORE_PROPOSAL_SENT, statusLabel } from '@/lib/domain/prospectStatus'

describe('Prospect stages', () => {
  it('lists the ten stored stages in pipeline order', () => {
    expect(STATUSES).toEqual([
      'NEW', 'CONTACTED', 'FOLLOW_UP', 'DISCOVERY_CALL', 'PROPOSAL_SENT',
      'CHANGES_REQUESTED', 'PROPOSAL_ACCEPTED', 'CONTRACT_SENT', 'WON', 'LOST',
    ])
  })

  it('names the booked-call stage Discovery Call', () => {
    expect(statusLabel('DISCOVERY_CALL')).toBe('Discovery Call')
    expect(statusLabel('FOLLOW_UP')).toBe('Follow-Up')
  })

  it('knows which stages a sent Proposal moves past', () => {
    expect(STAGES_BEFORE_PROPOSAL_SENT).toEqual([
      'NEW', 'CONTACTED', 'FOLLOW_UP', 'DISCOVERY_CALL', 'CHANGES_REQUESTED',
    ])
  })
})
