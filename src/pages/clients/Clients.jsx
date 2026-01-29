import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useSearchParams,
  useNavigate,
  useOutletContext,
} from 'react-router-dom'
import { toast } from 'sonner'
import { UserStar, X } from 'lucide-react'

import { fetchClients, deleteClient } from '@/api/clients'
import { useHeader } from '@/components/misc/header-context'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

import CreateClient from './CreateClient'
import EditClient from './EditClient'
import ClientCard from './ClientCard'
import { ClientCardSkeleton } from './ClientCardSkeleton'
import {
  SearchBar,
  IndustryFilter,
  TierFilter,
  UrgencyFilter,
} from './ClientFilters'

export default function Clients() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { setHeader } = useHeader()
  const { user } = useOutletContext()

  useEffect(() => {
    setHeader({
      title: 'Clients',
      breadcrumbs: [{ label: 'Clients', href: '/clients' }],
      actions: null,
    })
  }, [setHeader])

  const [createOpen, setCreateOpen] = useState(false)
  const [editClient, setEditClient] = useState(null)

  const search = searchParams.get('q') || ''
  const urgency = searchParams.get('urgency') || 'all'
  const industry = searchParams.get('industry') || 'all'
  const tier = searchParams.get('tier') || 'all'

  const updateParams = (key, value) => {
    const newParams = new URLSearchParams(searchParams)
    if (value === 'all' || value === '') {
      newParams.delete(key)
    } else {
      newParams.set(key, value)
    }
    setSearchParams(newParams, { replace: true })
  }

  const isFilterActive =
    search !== '' || urgency !== 'all' || industry !== 'all' || tier !== 'all'

  const resetFilters = () => setSearchParams({})
  const { data, isLoading, isPlaceholderData, error } = useQuery({
    queryKey: ['clients', user.id, { search, urgency, industry, tier }],
    queryFn: () => fetchClients({ search, urgency, industry, tier }),
    enabled: !!user?.id,
    // This keeps the previous counts/clients visible while the new ones load
    placeholderData: (previousData) => previousData,
  })

  const clients = data?.clients || []
  const counts = data?.counts || {}

  const deleteMutation = useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })

  function handleDelete(client) {
    return new Promise((resolve, reject) => {
      deleteMutation.mutate(client.id, {
        onSuccess: () => {
          toast.success('Client deleted')
          resolve()
        },
        onError: () => {
          toast.error('Failed to delete client')
          reject()
        },
      })
    })
  }

  function handleOpenClient(client) {
    navigate(`/clients/${client.id}`)
  }

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ClientCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-red-600 font-medium italic">
        Failed to load clients: {error.message}
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* --- ROW 1: TITLE & PRIMARY ACTION --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
        <Button onClick={() => setCreateOpen(true)}>Create Client</Button>
      </div>

      {/* ROW 2: TOOLBOX */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        {/* LEFT: Search + Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <SearchBar value={search} onChange={(v) => updateParams('q', v)} />

          <IndustryFilter
            value={industry}
            onValueChange={(v) => updateParams('industry', v)}
          />

          <TierFilter
            value={tier}
            onValueChange={(v) => updateParams('tier', v)}
          />
        </div>

        {/* RIGHT: Urgency tabs */}
        <div className="lg:ml-auto">
          <UrgencyFilter
            activeValue={urgency}
            onSelect={(v) => updateParams('urgency', v)}
            counts={counts}
          />
        </div>
      </div>

      {/* --- GRID SECTION --- */}
      {clients.length === 0 ? (
        <Empty className="py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserStar />
            </EmptyMedia>
            <EmptyTitle>
              {isFilterActive ? 'No results found' : 'Ready to scale?'}
            </EmptyTitle>
            <EmptyDescription>
              {isFilterActive
                ? "Try adjusting your filters or search terms to find what you're looking for."
                : "You haven't added any clients yet. Onboard your first partner to start managing their social pipeline."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {isFilterActive ? (
              <Button variant="outline" onClick={resetFilters}>
                Clear all filters
              </Button>
            ) : (
              <Button onClick={() => setCreateOpen(true)} size="lg">
                Create Your First Client
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(400px,1fr))] pb-20">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onOpen={handleOpenClient}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* --- MODALS --- */}
      <CreateClient open={createOpen} onOpenChange={setCreateOpen} />

      {editClient && (
        <EditClient client={editClient} onClose={() => setEditClient(null)} />
      )}
    </div>
  )
}
