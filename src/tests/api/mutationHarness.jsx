import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

// Renders a src/api mutation hook and records which query keys its onSuccess
// invalidates, so a test can assert "this change refreshes these views".
//
//   const { result, invalidated } = renderMutation(useUpdateInvoice)
//   await result.current.mutateAsync({ id: 'i1', updates: { status: 'PAID' } })
//   expect(invalidated()).toContainEqual(transactionKeys.all)
export function renderMutation(useHook) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(useHook, { wrapper })
  return {
    result,
    queryClient,
    invalidated: () => invalidate.mock.calls.map(([filters]) => filters?.queryKey),
  }
}
