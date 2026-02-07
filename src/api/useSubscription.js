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

      const storageUsed = sub.current_storage_used || 0
      const storageLimit = sub.max_storage_bytes
      const mbUsed = storageUsed / (1024 * 1024)

      return {
        // Branding Data
        agency_name: sub.agency_name || 'My Agency',
        logo_url: sub.logo_url,
        plan_name: sub.plan_name,

        // Limits
        client_count: count || 0,
        max_clients: sub.max_clients,

        // Storage Logic (MB before 1GB)
        storage_used_bytes: storageUsed,
        storage_max_bytes: storageLimit,
        storage_display: {
          value: mbUsed < 1024 ? mbUsed.toFixed(0) : (mbUsed / 1024).toFixed(1),
          unit: mbUsed < 1024 ? 'MB' : 'GB',
          percent: Math.min(100, (storageUsed / storageLimit) * 100),
        },
      }
    },
    staleTime: 1000 * 60 * 5,
  })
}
