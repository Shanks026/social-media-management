import { supabase } from '@/lib/supabase'

/**
 * Resolves the workspace scope for the current session.
 * - Admins (agency owners): workspaceUserId === their own UID
 * - Members (invited teammates): workspaceUserId === the agency owner's UID
 *
 * Use this in plain async mutation functions instead of supabase.auth.getUser()
 * when you need the user_id to scope DB writes correctly.
 */
export async function resolveWorkspace() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new Error('Not authenticated')

  const { data } = await supabase
    .from('agency_members')
    .select('agency_user_id')
    .eq('member_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  return {
    user,
    workspaceUserId: data?.agency_user_id ?? user.id,
  }
}
