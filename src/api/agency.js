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
 * ONBOARDING: single atomic agency setup.
 *
 * Replaces the old completeFullAgencySetup / setupBrandingOnly fork for the
 * onboarding path — there is now one flow, and it always provisions the
 * internal agency account (which consumes no client slot). Writes branding,
 * contact details and the invoice signatory to agency_subscriptions, then
 * creates-or-updates the internal client row.
 *
 * Address and website are written to BOTH tables: agency_subscriptions so the
 * values survive independently of the internal client row, and clients so
 * useSubscription's existing internal-client-first lookup keeps working.
 *
 * Explicitly omits every plan/subscription column — onboarding must never
 * touch plan_name, limits, or feature flags.
 */
export async function completeAgencyOnboarding(payload) {
  const { workspaceUserId } = await resolveWorkspace()

  // 1. Branding + contact + signatory
  const { error: subError } = await supabase
    .from('agency_subscriptions')
    .upsert(
      {
        user_id: workspaceUserId,
        agency_name: payload.agency_name,
        logo_url: payload.logo_url || null,
        logo_horizontal_url: payload.logo_horizontal_url || null,
        industry: payload.industry || null,
        email: payload.email || null,
        mobile_number: payload.mobile_number || null,
        description: payload.description || null,
        address: payload.address || null,
        website: payload.website || null,
        platforms: payload.platforms || [],
        social_links: payload.social_links || {},
        signatory_name: payload.signatory_name || null,
        signatory_designation: payload.signatory_designation || null,
        signature_url: payload.signature_url || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  if (subError) throw subError

  // 2. Internal agency account — look it up first, since the partial unique
  // index on (user_id) where is_internal makes upsert throw 42P10.
  const { data: existingClient, error: lookupError } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', workspaceUserId)
    .eq('is_internal', true)
    .maybeSingle()

  if (lookupError) throw lookupError

  const clientPayload = {
    user_id: workspaceUserId,
    name: payload.agency_name,
    logo_url: payload.logo_url || null,
    // The internal account is always stamped 'Internal' so it stays visually
    // separate from real clients; the user's real industry lives on
    // agency_subscriptions.industry.
    industry: 'Internal',
    status: 'ACTIVE',
    tier: 'INTERNAL',
    is_internal: true,
    platforms: payload.platforms || [],
    social_links: payload.social_links || {},
    email: payload.email,
    mobile_number: payload.mobile_number || null,
    website: payload.website || null,
    location: payload.location || null,
    address: payload.address || null,
    description: payload.description || null,
  }

  if (existingClient) {
    const { data, error } = await supabase
      .from('clients')
      .update(clientPayload)
      .eq('id', existingClient.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('clients')
    .insert(clientPayload)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Every step the setup checklist can surface. The wizard records which of these
 * the owner skipped; SetupChecklistCard decides done-ness from live data.
 */
export const ONBOARDING_STEP_KEYS = [
  'logos',
  // Superseded by 'logos' (which covers the square logo too), kept so rows
  // written before the rename still validate.
  'horizontal_logo',
  'signatory',
  'invite_team',
  'first_client',
]

/**
 * Stamp onboarding as finished and record which optional steps were skipped.
 * `onboarding_completed_at` is the workspace-level replacement for the old
 * per-device localStorage `has_seen_welcome_*` flag.
 */
export async function markOnboardingComplete({ skippedSteps = [] } = {}) {
  const { workspaceUserId } = await resolveWorkspace()

  const clean = skippedSteps.filter((k) => ONBOARDING_STEP_KEYS.includes(k))

  const { error } = await supabase
    .from('agency_subscriptions')
    .update({
      onboarding_completed_at: new Date().toISOString(),
      onboarding_skipped_steps: clean,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', workspaceUserId)

  if (error) throw error
}

/**
 * Permanently hide the dashboard setup checklist by clearing the skipped list.
 */
export async function dismissSetupChecklist() {
  const { workspaceUserId } = await resolveWorkspace()

  const { error } = await supabase
    .from('agency_subscriptions')
    .update({
      onboarding_skipped_steps: [],
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', workspaceUserId)

  if (error) throw error
}

/**
 * One-time migration of the legacy per-device flag. If a user dismissed
 * onboarding on this browser before the DB column existed, carry that forward
 * so the wizard doesn't reappear, then drop the key for good.
 */
export async function reconcileLegacyOnboardingFlag(userId) {
  const key = `has_seen_welcome_${userId}`
  let seen = false
  try {
    seen = localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
  if (!seen) return false

  const { workspaceUserId } = await resolveWorkspace()
  const { error } = await supabase
    .from('agency_subscriptions')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('user_id', workspaceUserId)
    .is('onboarding_completed_at', null)

  if (error) throw error

  try {
    localStorage.removeItem(key)
  } catch {
    /* nothing to clean up */
  }
  return true
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
    website: payload.website,
    location: payload.location,
    address: payload.address,
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
    website: brandingData.website,
    location: brandingData.location,
    address: brandingData.address,
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
