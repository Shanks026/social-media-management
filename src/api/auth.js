// Auth API (ADR 0007): the Supabase Auth calls the sign-in, sign-up, password
// and profile screens make. These are imperative multi-step flows with their
// own local state, so they are plain async functions; none of them caches.
//
// Signing out of the app goes through AuthContext's signOut, not here: it
// clears auth state at once instead of waiting for SIGNED_OUT.
import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Sign in with email and password. `client` is the Supabase client to sign in
 * on: the app's own by default, or an isolated one when linking a second
 * account (AddAccountDialog).
 *
 * A wrong password and an unknown email both come back from Supabase as
 * `invalid_credentials`; this says which it was.
 *
 * @returns the new session
 */
export async function signInWithPassword({ email, password }, client = supabase) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (!error) return data?.session ?? null

  if (error.code === 'invalid_credentials') {
    const { data: exists } = await client.rpc('check_email_exists', { p_email: email })
    throw new Error(
      exists
        ? 'Incorrect password. Please try again or reset your password.'
        : 'No account found with this email address. Please sign up.',
    )
  }
  throw error
}

/**
 * Create an agency owner account and send the welcome email (not awaited, and
 * never fails the sign-up).
 *
 * @returns the session, or null when the email must be confirmed first
 */
export async function signUpOwner({ email, password, name }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  })
  if (error) throw error

  supabase.functions
    .invoke('send-signup-welcome', { body: { email, name } })
    .catch(() => {})

  return data?.session ?? null
}

/**
 * Create (or sign back in to) the account an invited Member joins with. The
 * invite token rides in the user metadata. When sign-up returns no session
 * (the email already has an account), sign in with the same password.
 */
export async function signUpInvitedMember({ email, password, firstName, lastName, token }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        invite_token: token,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
      },
    },
  })
  if (error) throw error

  if (!data.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) throw signInError
  }
}

/** Welcome a genuinely new Member. Best effort: logged, never thrown. */
export async function sendTeamWelcome({ email, name, agencyName, systemRole }) {
  try {
    const { error } = await supabase.functions.invoke('send-team-welcome', {
      body: { email, name, agency_name: agencyName, system_role: systemRole },
    })
    if (error) console.error('[send-team-welcome]', error)
  } catch (err) {
    console.error('[send-team-welcome]', err)
  }
}

// ─── Passwords ────────────────────────────────────────────────────────────────

/** Forgot password, step 1: email a 6-digit recovery code. */
export async function sendPasswordResetCode(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email)
  if (error) throw error
}

/** Change password, step 1: email a 6-digit code to the signed-in user. */
export async function sendPasswordChangeCode(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  })
  if (error) throw error
}

/**
 * Step 2 of either flow: check the code. `type` is 'recovery' for a forgotten
 * password and 'email' for a change.
 */
export async function verifyPasswordCode({ email, code, type }) {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type })
  if (error) throw error
}

/**
 * Step 3 of either flow: set the new password, tell the user by email, then
 * sign out so they log in again with it. `reason` is 'reset' or 'change'.
 * A change first re-checks the old password.
 */
export async function updatePassword({ newPassword, reason, email, oldPassword }) {
  if (reason === 'change') {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: oldPassword,
    })
    if (signInError) throw new Error('Incorrect old password.')
  }

  const { data: userData, error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error

  // A fresh session, so the edge function's JWT check passes
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (userData?.user?.email && session?.access_token) {
    await supabase.functions.invoke('send-password-update-email', {
      body: { email: userData.user.email, type: reason },
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
  }

  // Recovery signs the user in implicitly; either way, make them log in again.
  await supabase.auth.signOut()
}

// ─── Profile ──────────────────────────────────────────────────────────────────

/** Upload a profile photo to post-media/avatars; returns its public URL. */
export async function uploadAvatar(file) {
  const fileExt = file.name.split('.').pop()
  const filePath = `avatars/${Date.now()}.${fileExt}`
  const { error } = await supabase.storage.from('post-media').upload(filePath, file)
  if (error) throw error
  return supabase.storage.from('post-media').getPublicUrl(filePath).data.publicUrl
}

/**
 * Save the signed-in user's profile metadata. When the photo changed, the old
 * one is removed from storage afterwards.
 */
export async function updateProfile({ fullName, avatarUrl, mobileNumber, previousAvatarUrl }) {
  const { error } = await supabase.auth.updateUser({
    data: { full_name: fullName, avatar_url: avatarUrl, mobile_number: mobileNumber },
  })
  if (error) throw error

  if (previousAvatarUrl && previousAvatarUrl !== avatarUrl) {
    const marker = '/post-media/'
    const idx = previousAvatarUrl.indexOf(marker)
    if (idx !== -1) {
      await supabase.storage.from('post-media').remove([previousAvatarUrl.slice(idx + marker.length)])
    }
  }
}

// ─── Session cache ────────────────────────────────────────────────────────────

/**
 * Forget everything cached for the signed-in user. Call it after signing out
 * or switching accounts: cached rows belong to the previous user, and some
 * (private meetings, notes, tasks) are visible only to them.
 */
export function useClearSessionCache() {
  const queryClient = useQueryClient()
  return useCallback(() => queryClient.clear(), [queryClient])
}
