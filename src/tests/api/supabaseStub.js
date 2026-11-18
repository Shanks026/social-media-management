// A recording stand-in for the supabase-js client, for testing src/api plain
// functions without a network (ADR 0007).
//
//   vi.mock('@/lib/supabase', async () => {
//     const { createSupabaseStub } = await import('@/tests/api/supabaseStub')
//     const sb = createSupabaseStub()
//     return { supabase: sb.client, __stub: sb }
//   })
//   import { __stub as sb } from '@/lib/supabase'
//
//   sb.answer('invoices', 'update', { data: {...}, error: null })
//   await updateInvoice(...)
//   sb.writes('transactions', 'insert')  // → [{ table, method, args }]
//
// Each query resolves the answer registered for `${table}.${operation}`, where
// the operation is the last of insert/update/delete/upsert called on it (else
// 'select'). RPCs and edge functions answer by name. Unregistered calls
// resolve { data: null, error: null }.

const WRITE_OPS = ['insert', 'update', 'delete', 'upsert']
const CHAIN_METHODS = [
  ...WRITE_OPS, 'select', 'eq', 'neq', 'in', 'is', 'not', 'or', 'gte', 'lte', 'gt', 'lt',
  'order', 'limit', 'range', 'ilike', 'like', 'contains', 'match', 'filter',
]

export function createSupabaseStub() {
  const calls = []
  let answers = {}
  const empty = () => ({ data: null, error: null })

  function resolve(key) {
    const answer = answers[key]
    return Promise.resolve(typeof answer === 'function' ? answer() : answer ?? empty())
  }

  function query(table) {
    let op = 'select'
    const node = {}
    for (const method of CHAIN_METHODS) {
      node[method] = (...args) => {
        if (WRITE_OPS.includes(method)) op = method
        calls.push({ table, method, args })
        return node
      }
    }
    node.single = () => resolve(`${table}.${op}`)
    node.maybeSingle = () => resolve(`${table}.${op}`)
    node.then = (onFulfilled, onRejected) => resolve(`${table}.${op}`).then(onFulfilled, onRejected)
    return node
  }

  const storageCalls = []
  const client = {
    from: (table) => query(table),
    rpc: (name, args) => {
      calls.push({ rpc: name, args })
      return resolve(`rpc.${name}`)
    },
    functions: {
      invoke: (name, options) => {
        calls.push({ fn: name, args: options })
        return resolve(`fn.${name}`)
      },
    },
    storage: {
      from: (bucket) => ({
        upload: (path, file, opts) => {
          storageCalls.push({ bucket, method: 'upload', path, opts })
          return resolve(`storage.${bucket}.upload`)
        },
        remove: (paths) => {
          storageCalls.push({ bucket, method: 'remove', paths })
          return resolve(`storage.${bucket}.remove`)
        },
        getPublicUrl: (path) => ({ data: { publicUrl: `https://stub/public/${bucket}/${path}` } }),
        createSignedUrl: (path) => resolve(`storage.${bucket}.createSignedUrl`).then((r) =>
          r.data ? r : { data: { signedUrl: `https://stub/signed/${bucket}/${path}` }, error: null }),
      }),
    },
    auth: {
      getUser: () => resolve('auth.getUser').then((r) =>
        r.data ? r : { data: { user: { id: 'user-1' } }, error: null }),
    },
    channel: () => ({ on() { return this }, subscribe() { return this } }),
    removeChannel: () => {},
  }

  return {
    client,
    calls,
    storageCalls,
    /**
     * Register what a call resolves: `answer('invoices', 'update', value)`, or
     * with a single key, `answer('rpc.name', value)` / `answer('fn.name', value)`.
     * A function value is called per request (e.g. to return a pending promise).
     */
    answer(...args) {
      const [key, value] = args.length === 2 ? args : [`${args[0]}.${args[1]}`, args[2]]
      answers[key] = value
    },
    reset() {
      calls.length = 0
      storageCalls.length = 0
      answers = {}
    },
    writes: (table, method) => calls.filter((c) => c.table === table && c.method === method),
    filters: (table, method = 'eq') => calls.filter((c) => c.table === table && c.method === method).map((c) => c.args),
    rpcs: (name) => calls.filter((c) => c.rpc === name),
    invocations: (name) => calls.filter((c) => c.fn === name),
  }
}
