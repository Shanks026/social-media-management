import { supabase } from '@/lib/supabase'
import { resolveWorkspace } from '@/lib/workspace'

export async function fetchAgencySettings() {
  const { workspaceUserId } = await resolveWorkspace()

  const { data, error } = await supabase
    .from('agency_subscriptions')
    .select('*')
    .eq('user_id', workspaceUserId)
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
  const { workspaceUserId } = await resolveWorkspace()

  // 1. Update Branding (Explicitly OMIT plan/subscription columns)
  const { error: subError } = await supabase
    .from('agency_subscriptions')
    .upsert(
      {
        user_id: workspaceUserId,
        agency_name: payload.name,
        logo_url: payload.logo_url,
        logo_horizontal_url: payload.logo_horizontal_url ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  if (subError) throw subError

  // 2. Manage Internal Client Account
  // Check if it already exists to avoid 42P10 error with partial indexes
  const { data: existingClient } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', workspaceUserId)
    .eq('is_internal', true)
    .maybeSingle()

  const clientPayload = {
    user_id: workspaceUserId,
    name: payload.name,
    logo_url: payload.logo_url,
    industry: payload.industry,
    status: payload.status,
    platforms: payload.platforms,
    social_links: payload.social_links,
    email: payload.email,
    mobile_number: payload.mobile_number,
    description: payload.description,
    tier: payload.tier,
    is_internal: true,
  }

  let clientResult
  if (existingClient) {
    const { data, error: updateError } = await supabase
      .from('clients')
      .update(clientPayload)
      .eq('id', existingClient.id)
      .select()
      .single()
    if (updateError) throw updateError
    clientResult = data
  } else {
    const { data, error: insertError } = await supabase
      .from('clients')
      .insert(clientPayload)
      .select()
      .single()
    if (insertError) throw insertError
    clientResult = data
  }

  return clientResult
}

/**
 * PATH B: Branding Only
 * Strictly updates identity; leaves clients table and plan_name alone.
 */
export async function setupBrandingOnly(payload) {
  const { workspaceUserId } = await resolveWorkspace()

  const { data, error } = await supabase
    .from('agency_subscriptions')
    .upsert(
      {
        user_id: workspaceUserId,
        agency_name: payload.name,
        logo_url: payload.logo_url,
        logo_horizontal_url: payload.logo_horizontal_url ?? null,
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
  const { user, workspaceUserId } = await resolveWorkspace()

  // Check for existing internal client
  const { data: existingClient } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', workspaceUserId)
    .eq('is_internal', true)
    .maybeSingle()

  const clientPayload = {
    user_id: workspaceUserId,
    name: brandingData.agency_name,
    logo_url: brandingData.logo_url,
    industry: brandingData.industry,
    platforms: brandingData.platforms,
    social_links: brandingData.social_links,
    email: brandingData.email || user.email,
    mobile_number: brandingData.mobile_number,
    description: brandingData.description,
    status: 'ACTIVE',
    tier: 'INTERNAL',
    is_internal: true,
  }

  let result
  if (existingClient) {
    const { data, error } = await supabase
      .from('clients')
      .update(clientPayload)
      .eq('id', existingClient.id)
      .select()
      .single()
    if (error) throw error
    result = data
  } else {
    const { data, error } = await supabase
      .from('clients')
      .insert(clientPayload)
      .select()
      .single()
    if (error) throw error
    result = data
  }

  return result
}
