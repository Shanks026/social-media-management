import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export function useSubscription() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['subscription', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return null

      const { data: sub, error: subError } = await supabase
        .from('agency_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (subError) throw subError

      const { count } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_internal', false)

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
        campaigns: sub.campaigns ?? false,
        client_count: count || 0,
        max_clients: sub.max_clients,

        storage_display: {
          usage_value: usageVal,
          usage_unit: usageUnit,
          max_value: maxVal,
          max_unit: maxUnit,
          percent: Math.min(100, (bytesUsed / bytesMax) * 100),
          remaining_label: remainingLabel, // Pass pre-calculated string
        },
      }
    },
    staleTime: 1000 * 60 * 5,
  })
}
