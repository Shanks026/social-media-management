import { useState, useEffect } from 'react'
import {
  Link2,
  Search,
  CheckSquare,
  Square,
  Activity,
  Play,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import {
  fetchUnlinkedPostsByClient,
  useAssignPostsToCampaign,
} from '@/api/campaigns'
import { toast } from 'sonner'
import StatusBadge from '@/components/StatusBadge'

const POST_STATUS_STYLES = {
  DRAFT: 'bg-muted text-muted-foreground',
  PENDING_APPROVAL:
    'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400',
  NEEDS_REVISION:
    'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
  SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  PUBLISHED:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
}

const PlatformIcon = ({ name }) => {
  const fileName = name === 'google_business' ? 'google_busines' : name
  const imgSrc = `/platformIcons/${fileName}.png`

  return (
    <div className="flex size-5 items-center justify-center rounded-full border border-white dark:border-[#1c1c1f] bg-white dark:bg-zinc-900 shadow-sm overflow-hidden shrink-0">
      <img
        src={imgSrc}
        alt={name}
        className="size-4 object-contain"
        onError={(e) => (e.target.style.display = 'none')}
      />
    </div>
  )
}

export function LinkPostsToCampaignDialog({
  open,
  onOpenChange,
  campaignId,
  clientId,
  campaignName,
}) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [search, setSearch] = useState('')

  const assignMutation = useAssignPostsToCampaign()

  useEffect(() => {
    if (!open || !clientId) return
    setLoading(true)
    setSelectedIds(new Set())
    setSearch('')
    fetchUnlinkedPostsByClient(clientId)
      .then(setPosts)
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [open, clientId])

  const filtered = posts.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()),
  )

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)))
    }
  }

  const handleLink = () => {
    if (selectedIds.size === 0) return
    assignMutation.mutate(
      { postIds: Array.from(selectedIds), campaignId },
      {
        onSuccess: () => {
          toast.success(`${selectedIds.size} post(s) linked to campaign`)
          onOpenChange(false)
        },
        onError: (err) => {
          toast.error('Failed to link posts: ' + err.message)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] flex flex-col rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 space-y-4">
          <div className="flex items-center gap-3">
            {/* <div className="p-2.5 bg-primary/10 rounded-full shrink-0">
              <Link2 className="h-5 w-5 text-primary" />
            </div> */}
            <div>
              <DialogTitle className="text-xl">Link Posts</DialogTitle>
              <DialogDescription className="mt-1">
                Select unlinked posts for{' '}
                <span className="font-semibold text-foreground">
                  {campaignName}
                </span>
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search posts..."
                className="pl-9 h-10 bg-muted/20 border-border/40 focus:bg-background transition-all shadow-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {filtered.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAll}
                className="h-10 text-xs font-semibold gap-2 px-3 hover:bg-primary/5 text-muted-foreground hover:text-primary"
              >
                {selectedIds.size === filtered.length ? (
                  <>
                    <Square className="size-3.5" />
                    Deselect
                  </>
                ) : (
                  <>
                    <CheckSquare className="size-3.5" />
                    Select All
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2 min-h-0">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 bg-muted/20 rounded-2xl mx-2">
              <Link2 className="size-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {posts.length === 0
                  ? 'No unlinked posts available for this client.'
                  : 'No posts match your search.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {filtered.map((post) => {
                const mediaUrl = post.media_urls?.[0]
                return (
                  <div
                    key={post.id}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all border border-transparent',
                      selectedIds.has(post.id)
                        ? 'bg-primary/10 border-primary/20 ring-1 ring-primary/20'
                        : 'hover:bg-muted/50',
                    )}
                    onClick={() => toggleSelect(post.id)}
                  >
                    <Checkbox
                      checked={selectedIds.has(post.id)}
                      className="data-[state=checked]:bg-primary shrink-0 transition-transform active:scale-90"
                    />

                    {mediaUrl ? (
                      <div className="w-10 h-10 rounded-lg border border-border/50 bg-muted relative overflow-hidden shadow-sm shrink-0">
                        {mediaUrl.match(/\.(mp4|mov|webm)$/i) ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/90">
                            <Play className="size-3.5 text-white fill-current" />
                          </div>
                        ) : (
                          <img
                            src={mediaUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg shrink-0 border border-border/50 bg-muted flex items-center justify-center shadow-sm">
                        <Activity className="size-4 text-muted-foreground/50" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1 ml-1">
                      <p className="text-sm font-semibold truncate text-foreground leading-tight">
                        {post.title || 'Untitled'}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {post.target_date && (
                          <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1.5 font-medium">
                            <span className="font-bold text-foreground/60 uppercase tracking-tight">
                              {post.status === 'PUBLISHED'
                                ? 'Published'
                                : 'Target'}
                            </span>
                            <span>
                              · {format(parseISO(post.target_date), 'MMM d, yyyy')}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-2.5">
                      <div className="scale-90 origin-right">
                        <StatusBadge status={post.status} />
                      </div>
                      <div className="flex items-center -space-x-1.5">
                        {post.platforms?.length > 0 ? (
                          post.platforms.map((p) => (
                            <PlatformIcon key={p} name={p} />
                          ))
                        ) : (
                          <span className="text-[10px] text-muted-foreground/50 ml-1">
                            No platform
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className="p-6 gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={assignMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleLink}
            disabled={selectedIds.size === 0 || assignMutation.isPending}
          >
            <Link2 className="size-4" />
            {assignMutation.isPending
              ? 'Linking…'
              : `Link ${selectedIds.size} ${selectedIds.size === 1 ? 'Post' : 'Posts'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
