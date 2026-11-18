import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { appConfigKeys } from '@/api/queryKeys'

export { appConfigKeys }

const MAINTENANCE_OFF = { is_active: false, message: null }

/**
 * The maintenance-mode flag. Live toggles arrive over Realtime, which only
 * invalidates the query (ADR 0007); a slow interval is the safety net.
 */
export function useMaintenanceMode() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('maintenance_mode_watch')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_config', filter: 'key=eq.maintenance_mode' },
        () => queryClient.invalidateQueries({ queryKey: appConfigKeys.maintenance() }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  return useQuery({
    queryKey: appConfigKeys.maintenance(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'maintenance_mode')
        .maybeSingle()

      // Gracefully degrade if the table doesn't exist yet (pre-migration)
      if (error) {
        console.warn('[maintenance] check failed:', error.message)
        return MAINTENANCE_OFF
      }

      return data?.value ?? MAINTENANCE_OFF
    },
    // Seed with "off" so the gate never has an undefined/pending window that
    // would blank the whole app.
    initialData: MAINTENANCE_OFF,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: false,
  })
}
