// useApiMutation: the one way src/api hooks wrap a plain mutation function
// (ADR 0007).
//
//   export function useApproveDeliverable(options) {
//     return useApiMutation(approveDeliverable, invalidateDeliverables, options)
//   }
//
// The hook owns the cache: `invalidate(queryClient, data, variables)` runs
// first, then any UI callbacks the caller passed in `options` (toasts,
// closing a dialog, navigating). Callers never touch the query client.
//
// `invalidateOn: 'settled'` refreshes even when the mutation throws. Use it
// for multi-step writes where an early step can land before a later one fails
// (status changed, email failed).
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useApiMutation(mutationFn, invalidate, options = {}) {
  const queryClient = useQueryClient()
  const { invalidateOn = 'success', onSuccess, onSettled, ...rest } = options

  return useMutation({
    ...rest,
    mutationFn,
    onSuccess: (data, variables, context) => {
      if (invalidateOn === 'success') invalidate?.(queryClient, data, variables)
      return onSuccess?.(data, variables, context)
    },
    onSettled: (data, error, variables, context) => {
      if (invalidateOn === 'settled') invalidate?.(queryClient, data, variables)
      return onSettled?.(data, error, variables, context)
    },
  })
}

/** An invalidate function that refreshes each of the given key roots. */
export const refresh = (...keys) => (queryClient) => {
  for (const queryKey of keys) queryClient.invalidateQueries({ queryKey })
}
