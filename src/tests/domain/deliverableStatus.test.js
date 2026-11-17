import { describe, it, expect } from 'vitest'
import {
  STATUSES,
  DELETABLE_STATUSES,
  statusLabel,
  clientStatusLabel,
  displayStatus,
} from '@/lib/domain/deliverableStatus'

describe('deliverable statuses', () => {
  it('lists the eleven stored statuses in lifecycle order', () => {
    expect(STATUSES).toEqual([
      'DRAFT', 'SUBMITTED', 'CHANGES_REQUESTED', 'READY',
      'PENDING_APPROVAL', 'NEEDS_REVISION', 'APPROVED', 'SCHEDULED',
      'PUBLISHED', 'DELIVERED', 'ARCHIVED',
    ])
  })

  it('lets a Member delete only before the work is committed', () => {
    expect(DELETABLE_STATUSES).toEqual(['DRAFT', 'SUBMITTED', 'ARCHIVED'])
  })
})

describe('statusLabel', () => {
  it('gives the internal label for stored and display states', () => {
    expect(statusLabel('PENDING_APPROVAL')).toBe('Awaiting Approval')
    expect(statusLabel('CHANGES_REQUESTED')).toBe('Changes Requested')
    expect(statusLabel('PARTIALLY_PUBLISHED')).toBe('Partially Published')
    expect(statusLabel('ARCHIVED')).toBe('Archived')
  })

  it('falls back to the raw value for something unknown', () => {
    expect(statusLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW')
    expect(statusLabel(null)).toBe('')
  })
})

describe('clientStatusLabel', () => {
  it('uses Client-facing wording', () => {
    expect(clientStatusLabel('DRAFT')).toBe('In Progress')
    expect(clientStatusLabel('NEEDS_REVISION')).toBe('In Revision')
    expect(clientStatusLabel('PENDING_APPROVAL')).toBe('Awaiting Approval')
  })

  it('says Published for a published Social deliverable, not Delivered', () => {
    expect(clientStatusLabel('PUBLISHED')).toBe('Published')
    expect(clientStatusLabel('PARTIALLY_PUBLISHED')).toBe('Partially Published')
    expect(clientStatusLabel('DELIVERED')).toBe('Delivered')
  })

  it('hides internal-review states behind In Progress', () => {
    expect(clientStatusLabel('SUBMITTED')).toBe('In Progress')
    expect(clientStatusLabel('CHANGES_REQUESTED')).toBe('In Progress')
    expect(clientStatusLabel('READY')).toBe('In Progress')
  })
})

describe('displayStatus', () => {
  it('is the stored status when there are no per-platform schedules', () => {
    expect(displayStatus({ status: 'SCHEDULED' })).toBe('SCHEDULED')
    expect(displayStatus({ status: 'SCHEDULED', platform_schedules: {} })).toBe('SCHEDULED')
  })

  it('is Partially published while only some platforms are live', () => {
    const version = {
      status: 'SCHEDULED',
      platform_schedules: {
        instagram: { scheduled_at: '2026-11-20T10:00:00Z', published_at: '2026-11-20T10:01:00Z' },
        linkedin: { scheduled_at: '2026-11-21T10:00:00Z', published_at: null },
      },
    }
    expect(displayStatus(version)).toBe('PARTIALLY_PUBLISHED')
  })

  it('is Published once every platform is live', () => {
    const version = {
      status: 'SCHEDULED',
      platform_schedules: {
        instagram: { published_at: '2026-11-20T10:01:00Z' },
        linkedin: { published_at: '2026-11-21T10:01:00Z' },
      },
    }
    expect(displayStatus(version)).toBe('PUBLISHED')
  })

  it('is the stored status while nothing is live yet', () => {
    expect(displayStatus({ status: 'SCHEDULED', platform_schedules: { x: { published_at: null } } })).toBe('SCHEDULED')
  })
})

describe('clientStatusCounts', () => {
  it('sums counts that share a client-facing label, in first-seen order', async () => {
    const { clientStatusCounts } = await import('@/lib/domain/deliverableStatus')
    expect(
      clientStatusCounts({ DRAFT: 2, READY: 1, PUBLISHED: 4, NEEDS_REVISION: 1 }),
    ).toEqual([
      ['In Progress', 3],
      ['Published', 4],
      ['In Revision', 1],
    ])
  })

  it('skips zero counts', async () => {
    const { clientStatusCounts } = await import('@/lib/domain/deliverableStatus')
    expect(clientStatusCounts({ DRAFT: 0, SCHEDULED: 2 })).toEqual([['Scheduled', 2]])
  })
})
