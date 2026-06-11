import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Aggregated per-client report payload, assembled server-side by the
 * `get_client_report` RPC from data Tercero already stores.
 *
 * Shape: { client, deliverables:{total,by_status}, campaigns:{total,budget_allocated},
 *          finance:{billed,collected,outstanding,overdue,invoice_count},
 *          proposals:{sent,accepted,value_won}, documents:{count,total_bytes},
 *          pipeline:{next_deliverable_at} }
 */
export function useClientReportData(clientId) {
  return useQuery({
    queryKey: ['reports', 'data', clientId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_client_report', {
        p_client_id: clientId,
      })
      if (error) throw error
      return data
    },
    enabled: !!clientId,
    staleTime: 30000,
    retry: 1,
  })
}
