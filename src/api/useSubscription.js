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

      // 1. Fetch Subscription Limits
      const { data: sub, error: subError } = await supabase
        .from('agency_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (subError) throw subError

      // 2. Fetch Live Client Count
      // We check the 'clients' table to get the real number
      const { count, error: countError } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      if (countError) throw countError

      // 3. Calculate Math for UI
      const clientLimit = sub.max_clients
      const currentClients = count || 0
      
      const storageUsed = sub.current_storage_used || 0
      const storageLimit = sub.max_storage_bytes
      
      // Convert bytes to GB for display
      const usedGB = (storageUsed / (1024 * 1024 * 1024)).toFixed(2)
      const limitGB = (storageLimit / (1024 * 1024 * 1024)).toFixed(0)
      const storagePercent = Math.min(100, (storageUsed / storageLimit) * 100)

      return {
        plan_name: sub.plan_name,
        // Client Limits
        client_count: currentClients,
        max_clients: clientLimit,
        is_client_limit_reached: currentClients >= clientLimit,
        
        // Storage Limits
        storage_used_bytes: storageUsed,
        storage_max_bytes: storageLimit,
        storage_display: {
          used: usedGB,
          limit: limitGB,
          percent: storagePercent
        }
      }
    },
    // Refresh every 5 minutes, or invalidate manually when a client is added
    staleTime: 1000 * 60 * 5, 
  })
}