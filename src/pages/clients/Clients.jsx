import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useSearchParams,
  useNavigate,
  useOutletContext,
} from 'react-router-dom'
import { toast } from 'sonner'
import { UserStar, X, Lock, Plus, Search } from 'lucide-react'

import { fetchClients, deleteClient } from '@/api/clients'
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

  const { data: subscription, isLoading: isSubLoading } = useSubscription()

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

  const handleCreateClick = () => {
    if (subscription?.is_client_limit_reached) {
      toast.error(`Plan limit reached. Please upgrade to add more.`)
      return
    }
    setCreateOpen(true)
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
    search !== '' || urgency !== 'all' || industry !== 'all' || tier !== 'all'
  const resetFilters = () => setSearchParams({})

  const { data, isLoading, error } = useQuery({
    queryKey: ['clients', user.id, { search, urgency, industry, tier }],
    queryFn: () => fetchClients({ search, urgency, industry, tier }),
    enabled: !!user?.id,
  })

  const clients = data?.clients || []
  const counts = data?.counts || {}

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
    navigate(`/clients/${client.id}`)
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
      <div className="px-8 pt-8 pb-20 space-y-8 max-w-[1400px] mx-auto">
        {/* --- SECTION 1: HEADER & PRIMARY ACTION --- */}
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-light tracking-tight text-foreground">
              Clients{' '}
              <span className="text-muted-foreground/50 ml-2 font-extralight">
                {clients.length}
              </span>
            </h1>
            <p className="text-sm text-muted-foreground font-light">
              Manage your active partnerships and social pipelines.
            </p>
          </div>

          <Button
            onClick={handleCreateClick}
            disabled={isSubLoading}
            size="lg"
            className={cn(
              'rounded-full px-6 shadow-sm transition-all duration-300 gap-2',
              subscription?.is_client_limit_reached
                ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border'
                : 'bg-primary text-primary-foreground hover:shadow-md',
            )}
          >
            {subscription?.is_client_limit_reached ? (
              <>
                <Lock className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wider font-bold">
                  Limit Reached
                </span>
              </>
            ) : (
              <>
                <Plus className="h-5 w-5" />
                <span className="font-medium">Create Client</span>
              </>
            )}
          </Button>
        </div>

        {/* --- SECTION 2: THE TOOLBAR (Google Search Aesthetic) --- */}
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

        {/* --- SECTION 3: THE CONTENT GRID --- */}
        {clients.length === 0 ? (
          <Empty className="py-32 bg-card/20 rounded-[32px] border border-dashed border-border/60">
            <EmptyHeader className="flex flex-col items-center">
              <div className="h-20 w-20 rounded-full bg-primary/5 flex items-center justify-center mb-6">
                <UserStar className="size-10 text-primary/40" />
              </div>
              <EmptyTitle className="text-2xl font-light">
                {isFilterActive
                  ? 'No clients match your criteria'
                  : 'Ready to scale your agency?'}
              </EmptyTitle>
              <EmptyDescription className="max-w-md text-center font-light">
                {isFilterActive
                  ? 'Adjust your filters or search terms to find specific client profiles.'
                  : 'Onboard your first partner to start managing their content strategy and workflow.'}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="mt-8">
              {isFilterActive ? (
                <Button
                  variant="ghost"
                  onClick={resetFilters}
                  className="rounded-full gap-2"
                >
                  <X className="size-4" /> Clear all filters
                </Button>
              ) : (
                <Button
                  onClick={handleCreateClick}
                  size="xl"
                  disabled={
                    isSubLoading || subscription?.is_client_limit_reached
                  }
                  className="rounded-full px-10 h-14"
                >
                  Onboard Your First Client
                </Button>
              )}
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(420px,1fr))] animate-in fade-in duration-500">
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
      </div>

      {/* --- MODALS --- */}
      <CreateClient open={createOpen} onOpenChange={setCreateOpen} />
      {editClient && (
        <EditClient client={editClient} onClose={() => setEditClient(null)} />
      )}
    </div>
  )
}
