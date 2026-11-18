// Agency API (ADR 0007): the agency's own identity (branding, signatory,
// onboarding state), stored on its internal client and its agency_subscriptions
// row. Plain async functions plus hooks that own the cache invalidation.
import { supabase } from '@/lib/supabase'
import { resolveWorkspace } from '@/lib/workspace'
import { useApiMutation } from '@/api/mutation'
import { clientKeys, subscriptionKeys } from '@/api/queryKeys'

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
 * Replaces the old two-path (full setup / branding only) fork for the
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

// ─── Branding assets (post-media) ─────────────────────────────────────────────

const BRANDING_BUCKET = 'post-media'

/** The storage path inside post-media for one of its public URLs, or null. */
export function extractStoragePath(publicUrl) {
  if (!publicUrl) return null
  const marker = `/${BRANDING_BUCKET}/`
  const idx = publicUrl.indexOf(marker)
  return idx !== -1 ? publicUrl.slice(idx + marker.length) : null
}

/**
 * Upload a File or Blob under `prefix` ('branding' for logos, 'signatures'
 * for the invoice signature) and return its public URL.
 */
export async function uploadBrandingAsset(fileOrBlob, prefix, ext) {
  const resolvedExt = ext || (fileOrBlob.name ? fileOrBlob.name.split('.').pop() : 'png')
  const filePath = `${prefix}/${Date.now()}.${resolvedExt}`

  const { error } = await supabase.storage
    .from(BRANDING_BUCKET)
    .upload(filePath, fileOrBlob, { contentType: fileOrBlob.type || undefined })
  if (error) throw error

  return supabase.storage.from(BRANDING_BUCKET).getPublicUrl(filePath).data.publicUrl
}

/**
 * Best-effort removal of a superseded asset. Never throws: an orphaned file
 * is not worth failing a save over.
 */
export async function removeBrandingAsset(publicUrl) {
  const path = extractStoragePath(publicUrl)
  if (!path) return
  try {
    await supabase.storage.from(BRANDING_BUCKET).remove([path])
  } catch {
    /* orphaned file; not worth surfacing */
  }
}

// ─── Branding writes ──────────────────────────────────────────────────────────

/**
 * Set the agency logo on its internal client and its subscription row (the
 * sidebar reads the latter). The replaced file is removed afterwards.
 * `logoUrl` '' or null clears it.
 */
export async function saveAgencyLogo({ internalClientId, logoUrl, previousUrl }) {
  const { workspaceUserId } = await resolveWorkspace()
  const dbUrl = logoUrl || null

  const { error: clientError } = await supabase
    .from('clients')
    .update({ logo_url: dbUrl })
    .eq('id', internalClientId)
  if (clientError) throw clientError

  const { error: subError } = await supabase
    .from('agency_subscriptions')
    .update({ logo_url: dbUrl, updated_at: new Date().toISOString() })
    .eq('user_id', workspaceUserId)
  if (subError) throw subError

  if (previousUrl && previousUrl !== (logoUrl || '')) await removeBrandingAsset(previousUrl)
}

/** Set (or clear) the horizontal logo used on documents. */
export async function saveHorizontalLogo({ logoUrl, previousUrl }) {
  const { workspaceUserId } = await resolveWorkspace()
  const { error } = await supabase
    .from('agency_subscriptions')
    .update({ logo_horizontal_url: logoUrl || null, updated_at: new Date().toISOString() })
    .eq('user_id', workspaceUserId)
  if (error) throw error

  if (previousUrl && previousUrl !== (logoUrl || '')) await removeBrandingAsset(previousUrl)
}

/** The signatory shown on invoices. */
export async function saveInvoiceSignatory({ name, designation, signatureUrl }) {
  const { workspaceUserId } = await resolveWorkspace()
  const { error } = await supabase
    .from('agency_subscriptions')
    .update({
      signatory_name: name || null,
      signatory_designation: designation || null,
      signature_url: signatureUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', workspaceUserId)
  if (error) throw error
}

/** Ask the Tercero team for a plan renewal or upgrade (an email to them). */
export async function requestPlanChange(request) {
  const { error } = await supabase.functions.invoke('send-renewal-request', { body: request })
  if (error) throw error
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

// The agency identity lives on the subscription row and the internal client.
const invalidateAgency = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: subscriptionKeys.all })
  queryClient.invalidateQueries({ queryKey: clientKeys.all })
}

export function useCompleteAgencyOnboarding(options) {
  return useApiMutation(completeAgencyOnboarding, invalidateAgency, options)
}

export function useMarkOnboardingComplete(options) {
  return useApiMutation(markOnboardingComplete, invalidateAgency, options)
}

export function useDismissSetupChecklist(options) {
  return useApiMutation(dismissSetupChecklist, invalidateAgency, options)
}

export function useActivateInternalWorkspace(options) {
  return useApiMutation(activateInternalWorkspace, invalidateAgency, options)
}

export function useSaveAgencyLogo(options) {
  return useApiMutation(saveAgencyLogo, invalidateAgency, options)
}

export function useSaveHorizontalLogo(options) {
  return useApiMutation(saveHorizontalLogo, invalidateAgency, options)
}

export function useSaveInvoiceSignatory(options) {
  return useApiMutation(saveInvoiceSignatory, invalidateAgency, options)
}
