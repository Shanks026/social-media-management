import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Globe, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import CreateDraftPost from '../../posts/DraftPostForm'
import DraftPostList from '../../posts/DraftPostList'
import { fetchAllPostsByClient } from '@/api/posts'
import { getPublishState } from '@/lib/helper'

const ALL_STATUS_TABS = [
  { key: 'ALL',                 label: 'All' },
  { key: 'DRAFT',               label: 'Drafts' },
  { key: 'PENDING_APPROVAL',    label: 'Pending Approval' },
  { key: 'APPROVED',            label: 'Approved' },
  { key: 'SCHEDULED',           label: 'Scheduled' },
  { key: 'NEEDS_REVISION',      label: 'Needs Revision' },
  { key: 'PARTIALLY_PUBLISHED', label: 'Partially Published' },
  { key: 'DELIVERED',           label: 'Delivered' },
  { key: 'PUBLISHED',           label: 'Published' },
]

const INTERNAL_EXCLUDED = ['PENDING_APPROVAL', 'NEEDS_REVISION']

export default function WorkflowTab({ client }) {
  const [createOpen, setCreateOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('ALL')

  const statusTabs = client.is_internal
    ? ALL_STATUS_TABS.filter((t) => !INTERNAL_EXCLUDED.includes(t.key))
    : ALL_STATUS_TABS

  // Same query key as DraftPostList — React Query deduplicates the request
  const { data: posts = [] } = useQuery({
    queryKey: ['draft-posts', client.id],
    queryFn: () => fetchAllPostsByClient(client.id),
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const counts = posts.reduce(
    (acc, post) => {
      const status = getPublishState(post)
      acc.ALL++
      if (status && status in acc) acc[status]++
      return acc
    },
    { ALL: 0, DRAFT: 0, PENDING_APPROVAL: 0, APPROVED: 0, SCHEDULED: 0, NEEDS_REVISION: 0, PARTIALLY_PUBLISHED: 0, DELIVERED: 0, PUBLISHED: 0 },
  )

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-4 w-full md:max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search deliverables..."
              className="pl-10 h-9 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Select>
            <SelectTrigger className="w-36 h-9 bg-background text-xs">
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5" />
                <SelectValue placeholder="Platform" />
              </div>
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="h-9 px-4"
          >
            <Plus className="h-4 w-4" /> Create Deliverable
          </Button>
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {statusTabs.map((tab) => {
          const count = counts[tab.key]
          const isActive = statusFilter === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                isActive
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-transparent text-muted-foreground border-border/60 hover:text-foreground hover:border-border'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`text-[11px] font-semibold tabular-nums ${isActive ? 'text-background/70' : 'text-muted-foreground'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <DraftPostList
        clientId={client.id}
        onCreatePost={() => setCreateOpen(true)}
        statusFilter={statusFilter}
      />
      <CreateDraftPost
        clientId={client.id}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  )
}
