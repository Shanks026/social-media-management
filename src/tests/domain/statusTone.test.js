import { describe, it, expect } from 'vitest'
import {
  statusTone,
  CHART_STATUSES,
  DELIVERABLE_CHART_CONFIG,
} from '@/lib/statusTone'
import { STATUSES, PARTIALLY_PUBLISHED } from '@/lib/domain/deliverableStatus'
import * as client from '@/lib/domain/clientStatus'
import * as invoice from '@/lib/domain/invoiceStatus'
import * as transaction from '@/lib/domain/transactionStatus'
import * as proposal from '@/lib/domain/proposalStatus'
import * as prospect from '@/lib/domain/prospectStatus'
import * as campaign from '@/lib/domain/campaignStatus'
import * as task from '@/lib/domain/taskStatus'

const ALL_DELIVERABLE = [...STATUSES, PARTIALLY_PUBLISHED]

describe('statusTone', () => {
  it('gives every Deliverable status, and the derived one, a tone, hex and icon', () => {
    for (const s of ALL_DELIVERABLE) {
      const tone = statusTone('deliverable', s)
      expect(tone.badge, s).toBeTruthy()
      expect(tone.hex, s).toMatch(/^#/)
      expect(tone.icon, s).toBeTruthy()
    }
  })

  it('gives every Deliverable status its own colour family', () => {
    const tones = ALL_DELIVERABLE.map((s) => statusTone('deliverable', s).tone)
    expect(new Set(tones).size).toBe(tones.length)
  })

  it('one tone drives badge, dot, border and chart colour', () => {
    const t = statusTone('deliverable', 'SCHEDULED')
    expect(t.tone).toBe('purple')
    expect(t.badge).toContain('purple')
    expect(t.dot).toContain('purple')
    expect(t.border).toContain('purple')
    expect(t.hex).toBe(DELIVERABLE_CHART_CONFIG.SCHEDULED.color)
  })

  it('has a real tone for every stored status of the other badge entities', () => {
    const known = (entity, list) =>
      list.forEach((s) => expect(statusTone(entity, s).tone, `${entity} ${s}`).not.toBe('slate-unmapped'))
    known('client', client.STATUSES)
    known('invoice', invoice.STATUSES)
    known('transaction', transaction.STATUSES)
    expect(statusTone('client', 'ACTIVE').tone).toBe('green')
    expect(statusTone('invoice', 'PAID').tone).toBe('emerald')
  })

  it('falls back to a neutral tone for unknown input', () => {
    expect(statusTone('deliverable', 'NOPE').tone).toBe('slate')
    expect(statusTone('nope', 'DRAFT').tone).toBe('slate')
  })

  it('labels charts from the domain module', () => {
    expect(DELIVERABLE_CHART_CONFIG['PENDING APPROVAL'].label).toBe('Awaiting Approval')
    expect(CHART_STATUSES).not.toContain('ARCHIVED')
  })
})

describe('statusTone for proposals, prospects, campaigns and tasks', () => {
  const cases = [
    ['proposal', proposal.DISPLAY_STATUSES],
    ['prospect', prospect.STATUSES],
    ['campaign', campaign.STATUSES],
    ['task', task.STATUSES],
    ['taskPriority', task.PRIORITIES],
  ]
  for (const [entity, list] of cases) {
    it(`${entity}: every status has a tone of its own (no fallback)`, () => {
      for (const s of list) {
        const tone = statusTone(entity, s)
        expect(tone.badge, `${entity} ${s}`).toBeTruthy()
        expect(tone).not.toBe(statusTone('nope', s))
      }
    })
  }

  it('task priority HIGH is one amber, everywhere', () => {
    const t = statusTone('taskPriority', 'HIGH')
    expect(t.tone).toBe('amber')
    expect(t.dot).toBe('bg-amber-500')
  })

  it('exposes a hover class for button-style triggers', () => {
    expect(statusTone('prospect', 'WON').hover).toContain('hover:')
  })
})
