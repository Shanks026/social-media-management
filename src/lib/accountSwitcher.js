import { supabase } from '@/lib/supabase'

const STORAGE_KEY = 'tercero_linked_accounts'
export const MAX_LINKED_ACCOUNTS = 5

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* localStorage unavailable (private browsing, quota, etc.) */
  }
}

/** All linked accounts on this device, most-recently-active first. */
export function getLinkedAccounts() {
  const store = readStore()
  return Object.values(store).sort((a, b) => b.updated_at - a.updated_at)
}

export function getLinkedAccount(userId) {
  return readStore()[userId] ?? null
}

/**
 * Upsert a single linked account's latest known tokens + display info.
 * Capped at MAX_LINKED_ACCOUNTS — adding a genuinely new account beyond the
 * cap evicts the least-recently-active one first, so the account that's
 * actually signed in right now is never the one dropped.
 */
export function upsertLinkedAccount(account) {
  const store = readStore()

  if (!store[account.user_id]) {
    const ids = Object.keys(store)
    if (ids.length >= MAX_LINKED_ACCOUNTS) {
      const lruId = ids.reduce((a, b) => (store[a].updated_at <= store[b].updated_at ? a : b))
      delete store[lruId]
    }
  }

  store[account.user_id] = account
  writeStore(store)
}

/** Forget an account locally — does not sign it out or revoke its tokens. */
export function removeLinkedAccount(userId) {
  const store = readStore()
  delete store[userId]
  writeStore(store)
}

/**
 * Switch the shared Supabase client's active session to a previously linked
 * account. Returns { success: true } or { success: false, error }. On a
 * stale/rotated refresh token, drops the dead entry rather than leaving it
 * around to fail the same way again.
 */
export async function switchToAccount(userId) {
  const account = getLinkedAccount(userId)
  if (!account) return { success: false, error: new Error('Account not found') }

  const { error } = await supabase.auth.setSession({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  })

  if (error) {
    removeLinkedAccount(userId)
    return { success: false, error }
  }

  return { success: true }
}
