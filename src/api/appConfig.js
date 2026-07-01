import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const MAINTENANCE_OFF = { is_active: false, message: null }

export function useMaintenanceMode() {
  return useQuery({
    queryKey: ['app-config', 'maintenance_mode'],
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
    // would blank the whole app. Live toggles arrive via the realtime
    // subscription in MaintenanceGate; the interval is just a slow safety net.
    initialData: MAINTENANCE_OFF,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: false,
  })
}
