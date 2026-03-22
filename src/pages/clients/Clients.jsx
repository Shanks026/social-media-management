import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useSearchParams,
  useNavigate,
  useOutletContext,
} from 'react-router-dom'
import { toast } from 'sonner'
import { UserStar, Lock, Plus, Search, FilterX } from 'lucide-react'

import { fetchClients, deleteClient } from '@/api/clients'
import { getUrgencyStatus } from '@/lib/client-helpers'
import { useHeader } from '@/components/misc/header-context'
import { useSubscription } from '../../api/useSubscription'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

// CreateClient import removed as it's now a dedicated page
import ClientCard from './ClientCard'
import { ClientCardSkeleton } from './ClientCardSkeleton'
import {
  SearchBar,
  IndustryFilter,
  TierFilter,
  UrgencyFilter,
  StatusFilter,
} from './ClientFilters'

export default function Clients() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { setHeader } = useHeader()
  const { user } = useOutletContext()

  const { data: subscription, isLoading: isSubLoading } = useSubscription()

  useEffect(() => {
    setHeader({
      title: 'Clients',
      breadcrumbs: [{ label: 'Clients', href: '/clients' }],
      actions: null,
    })
  }, [setHeader])

  // state for CreateClient modal removed

  const search = searchParams.get('q') || ''
  const urgency = searchParams.get('urgency') || 'all'
  const industry = searchParams.get('industry') || 'all'
  const tier = searchParams.get('tier') || 'all'
  const status = searchParams.get('status') || 'ACTIVE'

  // Refactored to navigate to the dedicated page
  const handleCreateClick = () => {
    if (subscription?.is_client_limit_reached) {
      toast.error(`Plan limit reached. Please upgrade to add more.`)
      return
    }
    navigate('/clients/create')
  }

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
    search !== '' || urgency !== 'all' || industry !== 'all' || tier !== 'all' || status !== 'ACTIVE'
  const resetFilters = () => setSearchParams({})

  const { data, isLoading } = useQuery({
    queryKey: ['clients', user.id, { search, industry, tier, status }],
    queryFn: () => fetchClients({ search, industry, tier, urgency: 'all', status }),
    enabled: !!user?.id,
  })

  const allClients = data?.clients || []

  // 1. Calculate counts for ALL urgency buckets based on the current set of clients (matched by search/industry/tier)
  const counts = {
    all: allClients.length,
    urgent: 0,
    upcoming: 0,
    idle: 0,
  }

  allClients.forEach((client) => {
    const health = getUrgencyStatus(client.pipeline?.next_post_at)
    if (!health) {
      counts.idle++
    } else if (health.label === 'Urgent' || health.label === 'Overdue') {
      counts.urgent++
    } else if (health.label === 'Warning') {
      counts.upcoming++
    }
  })

  // 2. Filter the displayed clients based on the selected urgency tab
  const clients = allClients.filter((client) => {
    if (urgency === 'all') return true
    const health = getUrgencyStatus(client.pipeline?.next_post_at)
    if (urgency === 'urgent')
      return health?.label === 'Urgent' || health?.label === 'Overdue'
    if (urgency === 'upcoming') return health?.label === 'Warning'
    if (urgency === 'idle') return !health
    return true
  })

  const sortedClients = [...clients].sort((a, b) => {
    if (a.is_internal && !b.is_internal) return -1
    if (!a.is_internal && b.is_internal) return 1
    return new Date(b.created_at || 0) - new Date(a.created_at || 0)
  })

  const realClientCount = clients.filter((c) => !c.is_internal).length

  const deleteMutation = useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
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
    if (client.is_internal) {
      // Route to the dedicated HQ
      navigate('/myorganization') // or whatever your route is for MyOrganization
    } else {
      // Route to standard client view
      navigate(`/clients/${client.id}`)
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 space-y-8 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48 rounded-md" />
            <Skeleton className="h-4 w-32 rounded-md" />
          </div>
          <Skeleton className="h-11 w-36 rounded-full" />
        </div>
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ClientCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-background selection:bg-primary/10">
      <div className="px-8 pt-8 pb-20 space-y-8 max-w-[1400px] mx-auto animate-page-fade-in">
        {/* --- SECTION 1: HEADER & PRIMARY ACTION --- */}
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-light tracking-tight text-foreground">
              Clients{' '}
              {realClientCount > 0 && (
                <span className="text-muted-foreground/50 ml-2 font-extralight">
                  {realClientCount}
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground font-light">
              Manage your active partnerships and social pipelines.
            </p>
          </div>

          <Button
            onClick={handleCreateClick}
            disabled={isSubLoading}
            className={cn(
              'h-9 gap-2 transition-all duration-300',
              subscription?.is_client_limit_reached &&
                'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border text-xs',
            )}
          >
            {subscription?.is_client_limit_reached ? (
              <>
                <Lock className="h-4 w-4" />
                <span>Limit Reached</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span>Create Client</span>
              </>
            )}
          </Button>
        </div>

        {/* --- SECTION 2: THE TOOLBAR --- */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
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
            <StatusFilter
              value={status}
              onValueChange={(v) => updateParams('status', v)}
            />
            {isFilterActive && (
              <button
                type="button"
                onClick={resetFilters}
                aria-label="Clear all filters"
                className="h-9 w-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <FilterX className="size-4" />
              </button>
            )}
          </div>

          <div className="lg:ml-auto flex items-center gap-4">
            <UrgencyFilter
              activeValue={urgency}
              onSelect={(v) => updateParams('urgency', v)}
              counts={counts}
            />
          </div>
        </div>

        {/* --- SECTION 3: THE CONTENT GRID --- */}
        {sortedClients.length === 0 ? (
          <Empty className="py-20 border border-dashed rounded-2xl bg-muted/5">
            <EmptyContent>
              <EmptyMedia variant="icon">
                {isFilterActive
                  ? <Search className="size-6 text-muted-foreground/60" />
                  : <UserStar className="size-6 text-muted-foreground/60" />}
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle className="font-normal text-xl">
                  {isFilterActive
                    ? 'No clients match your criteria'
                    : 'Ready to scale your agency?'}
                </EmptyTitle>
                <EmptyDescription className="font-light">
                  {isFilterActive
                    ? 'Adjust your filters or search terms to find specific client profiles.'
                    : 'Onboard your first partner to start managing their content strategy and workflow.'}
                </EmptyDescription>
              </EmptyHeader>
              {isFilterActive ? (
                <Button
                  variant="link"
                  onClick={resetFilters}
                  className="text-primary font-medium"
                >
                  Clear all filters
                </Button>
              ) : (
                <Button
                  onClick={handleCreateClick}
                  variant="outline"
                  size="sm"
                  disabled={isSubLoading || subscription?.is_client_limit_reached}
                >
                  <Plus className="size-4 mr-2" />
                  Onboard Your First Client
                </Button>
              )}
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(420px,1fr))]">
            {sortedClients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                onOpen={handleOpenClient}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* --- MODALS --- */}
      {/* CreateClient modal removed */}
    </div>
  )
}
