// src/api/agency.js
import { supabase } from '@/lib/supabase'

/**
 * Fetch the current user's agency settings (branding, limits, etc.)
 */
export async function fetchAgencySettings() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('agency_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * COMPLETE ONBOARDING:
 * 1. Updates agency_subscriptions with Name/Logo/Color
 * 2. Creates the "Internal" Client row automatically
 */
// src/api/agency.js
// src/api/agency.js
export async function completeAgencySetup(payload) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 1. Use UPSERT to guarantee the row is created or updated
  const { error: subError } = await supabase
    .from('agency_subscriptions')
    .upsert(
      {
        user_id: user.id,
        agency_name: payload.name,
        logo_url: payload.logo_url,
        social_links: payload.social_links,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  if (subError) throw subError

  // 2. Internal Client Upsert
  const { data, error: clientError } = await supabase
    .from('clients')
    .upsert(
      {
        ...payload,
        user_id: user.id,
        is_internal: true,
      },
      { onConflict: 'user_id,is_internal' },
    )
    .select()
    .single()

  if (clientError) throw clientError
  return data
}
