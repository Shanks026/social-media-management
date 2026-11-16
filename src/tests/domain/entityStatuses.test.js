import { describe, it, expect } from 'vitest'
import * as task from '@/lib/domain/taskStatus'
import * as invoice from '@/lib/domain/invoiceStatus'
import * as client from '@/lib/domain/clientStatus'
import * as transaction from '@/lib/domain/transactionStatus'

describe('Task statuses and priorities', () => {
  it('lists stored statuses and priorities in order', () => {
    expect(task.STATUSES).toEqual(['TODO', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'])
    expect(task.PRIORITIES).toEqual(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
  })

  it('labels them', () => {
    expect(task.statusLabel('TODO')).toBe('To Do')
    expect(task.statusLabel('IN_PROGRESS')).toBe('In Progress')
    expect(task.priorityLabel('URGENT')).toBe('Urgent')
    expect(task.priorityLabel('NORMAL')).toBe('Normal')
  })
})

describe('Invoice statuses', () => {
  it('lists stored statuses and labels them', () => {
    expect(invoice.STATUSES).toEqual(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID'])
    expect(invoice.statusLabel('VOID')).toBe('Void')
    expect(invoice.statusLabel('OVERDUE')).toBe('Overdue')
  })
})

describe('Client statuses', () => {
  it('lists stored statuses and labels them', () => {
    expect(client.STATUSES).toEqual(['ACTIVE', 'PAUSED', 'ARCHIVED'])
    expect(client.statusLabel('PAUSED')).toBe('Paused')
  })
})

describe('transaction statuses', () => {
  it('lists stored statuses and labels them', () => {
    expect(transaction.STATUSES).toEqual(['PAID', 'PENDING', 'OVERDUE'])
    expect(transaction.statusLabel('PENDING')).toBe('Pending')
  })
})

describe('labels for unknown values', () => {
  it('fall back to the raw value, and to empty for nothing', () => {
    for (const mod of [task, invoice, client, transaction]) {
      expect(mod.statusLabel('NOPE')).toBe('NOPE')
      expect(mod.statusLabel(undefined)).toBe('')
    }
  })
})
