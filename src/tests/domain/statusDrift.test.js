// ADR 0006 drift test: every stored status list in src/lib/domain must equal
// the latest CHECK constraint for that column in supabase/migrations.
//
// Convention this relies on: a status CHECK is always named
// `<table>_<column>_check` (Postgres's default name), and lists its values as
// string literals. No database is needed: the migrations are the source of
// truth for what production and `db reset` build.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as deliverable from '@/lib/domain/deliverableStatus'
import * as task from '@/lib/domain/taskStatus'
import * as invoice from '@/lib/domain/invoiceStatus'
import * as client from '@/lib/domain/clientStatus'
import * as transaction from '@/lib/domain/transactionStatus'

// Vitest runs from the project root (jsdom's import.meta.url isn't a file URL).
const MIGRATIONS_DIR = resolve('supabase/migrations')

const migrationSql = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort() // version prefix = apply order
  .map((f) => readFileSync(resolve(MIGRATIONS_DIR, f), 'utf8'))
  .join('\n')

/** The text inside the parentheses that open at `start`. */
function balancedParens(sql, start) {
  let depth = 0
  for (let i = start; i < sql.length; i++) {
    if (sql[i] === '(') depth++
    else if (sql[i] === ')' && --depth === 0) return sql.slice(start + 1, i)
  }
  throw new Error('unbalanced CHECK expression')
}

/**
 * The values of the last definition of constraint `name`, or null if the last
 * thing that happened to it was a DROP.
 */
export function latestCheckValues(sql, name) {
  const define = new RegExp(`"?${name}"?\\s+CHECK\\s*\\(`, 'g')
  const drop = new RegExp(`DROP\\s+CONSTRAINT\\s+(IF\\s+EXISTS\\s+)?"?${name}"?`, 'gi')
  let lastDefine = null
  for (const m of sql.matchAll(define)) lastDefine = m
  let lastDrop = -1
  for (const m of sql.matchAll(drop)) lastDrop = m.index
  if (!lastDefine || lastDrop > lastDefine.index) return null
  const expr = balancedParens(sql, lastDefine.index + lastDefine[0].length - 1)
  return [...expr.matchAll(/'([^']*)'/g)].map((m) => m[1])
}

const MIRRORS = [
  ['post_versions_status_check', deliverable.STATUSES],
  ['transactions_status_check', transaction.STATUSES],
  ['tasks_status_check', task.STATUSES],
  ['tasks_priority_check', task.PRIORITIES],
  ['invoices_status_check', invoice.STATUSES],
  ['clients_status_check', client.STATUSES],
]

describe('status lists match the database CHECKs (ADR 0006)', () => {
  it.each(MIRRORS)('%s', (constraint, values) => {
    const dbValues = latestCheckValues(migrationSql, constraint)
    expect(dbValues, `no CHECK named ${constraint} in the migrations`).not.toBeNull()
    expect([...values].sort()).toEqual([...dbValues].sort())
  })
})

describe('latestCheckValues', () => {
  it('takes the last definition and honours a later drop', () => {
    const sql = `
      CONSTRAINT "x_status_check" CHECK (("status" = ANY (ARRAY['A'::"text", 'B'::"text"])))
      ALTER TABLE x ADD CONSTRAINT x_status_check CHECK (status = ANY (ARRAY['A', 'B', 'C']::text[]));
    `
    expect(latestCheckValues(sql, 'x_status_check')).toEqual(['A', 'B', 'C'])
    expect(latestCheckValues(sql + 'ALTER TABLE x DROP CONSTRAINT x_status_check;', 'x_status_check')).toBeNull()
  })
})
