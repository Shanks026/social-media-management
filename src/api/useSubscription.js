import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

// ── TESTING ONLY: set to a number (1–16+) to simulate a trial day.
// Day 1 = first day of trial, Day 15 = grace period, Day 16 = locked.
// Set to null for production.
const TRIAL_DAY_OVERRIDE = null // e.g. TRIAL_DAY_OVERRIDE = 8

// ── TESTING ONLY: set to a number to simulate days until subscription expiry.
// Positive = days remaining, 0 = expires today, negative = days past expiry.
// Set to null for production.
const SUB_DAY_OVERRIDE = null // e.g. SUB_DAY_OVERRIDE = 2

export function useSubscription() {
  const { workspaceUserId } = useAuth()

  return useQuery({
    queryKey: ['subscription', workspaceUserId],
    enabled: !!workspaceUserId,
    queryFn: async () => {
      if (!workspaceUserId) return null

      const { data: sub, error: subError } = await supabase
        .from('agency_subscriptions')
        .select('*')
        .eq('user_id', workspaceUserId)
        .single()

      if (subError) {
        // PGRST116 = no rows returned by .single() — subscription record missing.
        // This means the account was deleted while the user was logged in.
        if (subError.code === 'PGRST116' || subError.status === 406) {
          await supabase.auth.signOut()
        }
        throw subError
      }

      const { count } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', workspaceUserId)
        .eq('is_internal', false)

      // Internal (agency) client — single source for agency contact details on invoices
      const { data: internalClient } = await supabase
        .from('clients')
        .select('email, website, address')
        .eq('user_id', workspaceUserId)
        .eq('is_internal', true)
        .maybeSingle()

      // Storage Calculation Logic
      const bytesUsed = sub.current_storage_used || 0
      const bytesMax = sub.max_storage_bytes || 0
      const gbThreshold = 1024 * 1024 * 1024 // 1 GB in bytes

      // 1. Calculate Usage Display (MB vs GB)
      let usageVal, usageUnit
      if (bytesUsed < gbThreshold) {
        // If < 1GB, show as MB (e.g. 500.5)
        usageVal = (bytesUsed / (1024 * 1024)).toFixed(1)
        usageUnit = 'MB'
      } else {
        // If >= 1GB, show as GB (e.g. 1.2)
        usageVal = (bytesUsed / gbThreshold).toFixed(1)
        usageUnit = 'GB'
      }

      // 2. Calculate Max Display (Usually GB)
      const maxVal = (bytesMax / gbThreshold).toFixed(0)
      const maxUnit = 'GB'

      // 3. Calculate Remaining (Handle mixed units)
      const bytesRemaining = Math.max(0, bytesMax - bytesUsed)
      let remainingLabel
      if (bytesRemaining < gbThreshold) {
        remainingLabel = `${(bytesRemaining / (1024 * 1024)).toFixed(0)} MB remaining`
      } else {
        remainingLabel = `${(bytesRemaining / gbThreshold).toFixed(1)} GB remaining`
      }

      const brandingAgencySidebar = sub.branding_agency_sidebar ?? false
      const brandingPoweredBy = sub.branding_powered_by ?? true

      // ── Trial state ────────────────────────────────────────────────────────
      const isTrial = sub.plan_name === 'trial'
      let trialPhase = null
      let trialDaysRemaining = null

      if (isTrial && sub.trial_ends_at) {
        let daysUntilExpiry

        if (TRIAL_DAY_OVERRIDE !== null) {
          // Testing: Day 1 = 13 days remaining, Day 14 = 0, Day 15 = -1, Day 16 = -2
          daysUntilExpiry = 14 - TRIAL_DAY_OVERRIDE
        } else {
          const msUntilExpiry = new Date(sub.trial_ends_at) - new Date()
          daysUntilExpiry = Math.floor(msUntilExpiry / (1000 * 60 * 60 * 24))
        }

        trialDaysRemaining = Math.max(daysUntilExpiry, 0)

        if (daysUntilExpiry >= 6)          trialPhase = 'active'
        else if (daysUntilExpiry >= 2)     trialPhase = 'warning'
        else if (daysUntilExpiry >= 0)     trialPhase = 'critical'
        else if (daysUntilExpiry === -1)   trialPhase = 'grace'
        else                               trialPhase = 'expired'
      }

      // ── Subscription expiry state (paid plans only) ───────────────────────
      const isPaidPlan = !isTrial
      let subPhase = null
      let subDaysRemaining = null

      if (isPaidPlan && sub.subscription_ends_at) {
        let daysUntilSubExpiry

        if (SUB_DAY_OVERRIDE !== null) {
          daysUntilSubExpiry = SUB_DAY_OVERRIDE
        } else {
          const msUntil = new Date(sub.subscription_ends_at) - new Date()
          daysUntilSubExpiry = Math.floor(msUntil / (1000 * 60 * 60 * 24))
        }

        subDaysRemaining = Math.max(daysUntilSubExpiry, 0)

        if (daysUntilSubExpiry > 7)          subPhase = 'active'
        else if (daysUntilSubExpiry >= 3)    subPhase = 'warning'
        else if (daysUntilSubExpiry >= 0)    subPhase = 'critical'
        else if (daysUntilSubExpiry >= -3)   subPhase = 'grace'
        else                                 subPhase = 'expired'
      }

      return {
        agency_name: sub.agency_name || 'Tercero',
        logo_url: sub.logo_url,
        logo_horizontal_url: sub.logo_horizontal_url ?? null,
        plan_name: sub.plan_name,
        // Branding flags (new column names)
        branding_agency_sidebar: brandingAgencySidebar,
        branding_powered_by: brandingPoweredBy,
        // Derived whitelabel flags for invoice/document components
        basic_whitelabel_enabled: brandingAgencySidebar && brandingPoweredBy,
        full_whitelabel_enabled: brandingAgencySidebar && !brandingPoweredBy,
        // Feature flags
        finance_recurring_invoices: sub.finance_recurring_invoices ?? false,
        finance_subscriptions: sub.finance_subscriptions ?? false,
        finance_accrual: sub.finance_accrual ?? false,
        calendar_export: sub.calendar_export ?? false,
        documents_collections: sub.documents_collections ?? false,
        reports: sub.reports ?? false,
        campaigns: true,
        campaigns_limit: sub.plan_name === 'ignite' ? 8 : null,
        proposals_limit: sub.proposals_limit ?? null,
        client_count: count || 0,
        max_clients: sub.max_clients,
        // sub.max_clients is null for unlimited plans (Quantum/Trial) — must
        // short-circuit before the comparison, since `count >= null` coerces
        // null to 0 in JS and would incorrectly evaluate true for any count.
        is_client_limit_reached: sub.max_clients != null && (count || 0) >= sub.max_clients,
        max_team_members: sub.max_team_members ?? null,
        is_trial: isTrial,
        trial_phase: trialPhase,
        trial_days_remaining: trialDaysRemaining,
        trial_ends_at: sub.trial_ends_at ?? null,
        is_trial_locked: trialPhase === 'expired',
        sub_phase: subPhase,
        sub_days_remaining: subDaysRemaining,
        subscription_ends_at: sub.subscription_ends_at ?? null,
        is_sub_locked: subPhase === 'expired',

        // Workspace deletion grace period
        deletion_scheduled_at: sub.scheduled_for_deletion_at ?? null,
        is_pending_deletion: !!sub.scheduled_for_deletion_at,

        // Agency contact for invoices — sourced from the agency (internal client) record
        email: internalClient?.email ?? sub.email ?? null,
        mobile_number: sub.mobile_number ?? null,
        agency_address: internalClient?.address ?? null,
        agency_website: internalClient?.website ?? null,
        // Invoice settings — signatory only (genuinely invoice-specific)
        signatory_name: sub.signatory_name ?? null,
        signatory_designation: sub.signatory_designation ?? null,
        signature_url: sub.signature_url ?? null,

        storage_display: {
          usage_value: usageVal,
          usage_unit: usageUnit,
          max_value: maxVal,
          max_unit: maxUnit,
          percent: Math.min(100, (bytesUsed / bytesMax) * 100),
          remaining_label: remainingLabel,
        },
      }
    },
    staleTime: 1000 * 60 * 5,
    retry: (failureCount, error) => {
      // Don't retry if the subscription record doesn't exist or auth is invalid
      if (error?.code === 'PGRST116' || error?.status === 406 || error?.status === 401) return false
      return failureCount < 1
    },
  })
}
