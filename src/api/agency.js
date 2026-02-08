import { supabase } from '@/lib/supabase'

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
 * PATH A: Full Branding + Internal Account
 * This creates the internal 'client' row using the UI Tier (PRO/BASIC/VIP),
 * but strictly avoids modifying the administrative Subscription Plan.
 */
export async function completeFullAgencySetup(payload) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 1. Update Branding (Explicitly OMIT plan/subscription columns)
  const { error: subError } = await supabase
    .from('agency_subscriptions')
    .upsert(
      {
        user_id: user.id,
        agency_name: payload.name,
        logo_url: payload.logo_url,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  if (subError) throw subError

  // 2. Create Internal Client Account (Stores the UI 'tier' here)
  const { data, error: clientError } = await supabase
    .from('clients')
    .upsert(
      {
        user_id: user.id,
        name: payload.name,
        logo_url: payload.logo_url,
        industry: payload.industry,
        status: payload.status,
        platforms: payload.platforms,
        social_links: payload.social_links,
        email: payload.email,
        mobile_number: payload.mobile_number,
        description: payload.description,
        tier: payload.tier, // Store 'PRO/BASIC/VIP' as client metadata
        is_internal: true,
      },
      { onConflict: 'user_id,is_internal' },
    )
    .select()
    .single()

  if (clientError) throw clientError
  return data
}

/**
 * PATH B: Branding Only
 * Strictly updates identity; leaves clients table and plan_name alone.
 */
export async function setupBrandingOnly(payload) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('agency_subscriptions')
    .upsert(
      {
        user_id: user.id,
        agency_name: payload.name,
        logo_url: payload.logo_url,
        // Save the extra business/contact data here as well
        industry: payload.industry,
        platforms: payload.platforms,
        social_links: payload.social_links,
        email: payload.email,
        mobile_number: payload.mobile_number,
        description: payload.description,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single()

  if (error) throw error
  return data
}

export async function activateInternalWorkspace(brandingData) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('clients')
    .upsert(
      {
        user_id: user.id,
        name: brandingData.agency_name,
        logo_url: brandingData.logo_url,
        industry: brandingData.industry,
        platforms: brandingData.platforms,
        social_links: brandingData.social_links,
        email: brandingData.email || user.email,
        mobile_number: brandingData.mobile_number,
        description: brandingData.description,
        status: 'ACTIVE',
        tier: 'PRO',
        is_internal: true,
      },
      { onConflict: 'user_id,is_internal' },
    )
    .select()
    .single()

  if (error) throw error
  return data
}
