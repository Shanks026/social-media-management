import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// A throwaway auth client for authenticating a *second* account without
// disturbing the primary `supabase` singleton's active session. Never
// touches localStorage (persistSession: false) — used for the lifetime of
// one signInWithPassword call in AddAccountDialog, then discarded.
export function createIsolatedAuthClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
