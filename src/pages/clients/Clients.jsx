import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { fetchClients, deleteClient } from '@/api/clients'

import { Button } from '@/components/ui/button'
import CreateClient from './CreateClient'
import EditClient from './EditClient'
import ClientCard from './ClientCard'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ClientCardSkeleton } from './ClientCardSkeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { useHeader } from '@/components/misc/header-context'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { UserStar } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'

export default function Clients() {
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

  const {
    data: clients = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['clients', user.id],
    queryFn: fetchClients,
    enabled: !!user?.id,
  })

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
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-32" />
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
      <div className="p-8 text-red-600">
        Failed to load clients: {error.message}
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <Button onClick={() => setCreateOpen(true)}>Create Client</Button>
      </div>

      {clients.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserStar />
            </EmptyMedia>
            <EmptyTitle>No Clients Yet</EmptyTitle>
            <EmptyDescription>
              You haven&apos;t created any clients yet. Get started by creating
              your first client.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex gap-2">
              <Button onClick={() => setCreateOpen(true)}>Create Client</Button>
            </div>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(400px,1fr))]">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onOpen={handleOpenClient}
              onEdit={setEditClient}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <CreateClient open={createOpen} onOpenChange={setCreateOpen} />

      {editClient && (
        <EditClient client={editClient} onClose={() => setEditClient(null)} />
      )}
    </div>
  )
}
