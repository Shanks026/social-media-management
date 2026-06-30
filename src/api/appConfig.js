import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

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
        return { is_active: false, message: null }
      }

      return data?.value ?? { is_active: false, message: null }
    },
    staleTime: 0,
    refetchInterval: 30_000,
    retry: false,
  })
}
