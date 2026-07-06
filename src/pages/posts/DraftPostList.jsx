import { useQuery } from '@tanstack/react-query'
import { fetchAllPostsByClient } from '@/api/posts'
import { useAuth } from '@/context/AuthContext'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { getPublishState } from '@/lib/helper'
import { DeliverableCard } from '@/components/deliverables/DeliverableCard'

/**
 * Grid of deliverable cards scoped to a single client (used inside
 * ClientProfileView's Workflow tab). `client` is the full client record
 * ({ id, name, logo_url, ... }) so DeliverableCard can display client
 * identity even though fetchAllPostsByClient doesn't embed it per-post.
 */
export default function DraftPostList({ client, onCreatePost, statusFilter = 'ALL', myWorkOnly = false }) {
  const { user } = useAuth()
  const clientId = client?.id

  const { data = [], isLoading } = useQuery({
    queryKey: ['draft-posts', clientId],
    queryFn: () => fetchAllPostsByClient(clientId),
    enabled: !!clientId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const filteredData = data
    .filter((p) => statusFilter === 'ALL' || getPublishState(p) === statusFilter)
    .filter((p) => !myWorkOnly || p.created_by === user?.id)

  if (isLoading)
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[400px] w-full rounded-2xl" />
        ))}
      </div>
    )

  if (filteredData.length === 0)
    return (
      <Empty className="py-20 border border-dashed rounded-2xl bg-muted/5">
        <EmptyContent>
          <div className="text-4xl leading-none select-none mb-2">📝</div>
          <EmptyHeader>
            <EmptyTitle className="font-bold text-xl">
              {statusFilter === 'ALL' ? 'No deliverables yet' : 'No deliverables found'}
            </EmptyTitle>
            <EmptyDescription className="font-normal">
              {statusFilter === 'ALL'
                ? 'Create your first draft to start building content for this client.'
                : 'No deliverables match this status filter.'}
            </EmptyDescription>
          </EmptyHeader>
          {statusFilter === 'ALL' && onCreatePost && (
            <Button onClick={onCreatePost} variant="outline" className="mt-2">
              <Plus className="size-4" />
              Create Deliverable
            </Button>
          )}
        </EmptyContent>
      </Empty>
    )

  return (
    <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(350px,1fr))]">
      {filteredData.map((post) => (
        <DeliverableCard key={post.id} post={post} client={client} />
      ))}
    </div>
  )
}
