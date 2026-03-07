import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Folder, FolderOpen } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useCollections, moveDocumentToCollection, documentKeys } from '@/api/documents'
import CreateCollectionDialog from './CreateCollectionDialog'

export default function MoveToCollectionDialog({ open, onOpenChange, document }) {
  const queryClient = useQueryClient()
  const [selectedCollectionId, setSelectedCollectionId] = useState(
    document?.collection_id ?? null,
  )
  const [createOpen, setCreateOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const { data: collections = [], isLoading } = useCollections(document?.client_id)

  const moveMutation = useMutation({
    mutationFn: (collectionId) => moveDocumentToCollection(document.id, collectionId),
    onSuccess: (_, collectionId) => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'list'] })
      queryClient.invalidateQueries({ queryKey: documentKeys.collections(document.client_id) })
      queryClient.invalidateQueries({ queryKey: documentKeys.allCollections() })
      const target = collections.find((c) => c.id === collectionId)
      if (collectionId === null) {
        toast.success('Document removed from collection')
      } else {
        toast.success(`Document moved to ${target?.name ?? 'collection'}`)
      }
      onOpenChange(false)
    },
    onError: (err) => toast.error(err.message || 'Failed to move document'),
  })

  // Reset state whenever dialog opens
  function handleOpenChange(nextOpen) {
    if (nextOpen) {
      setSelectedCollectionId(document?.collection_id ?? null)
      setConfirmRemove(false)
    }
    onOpenChange(nextOpen)
  }

  const isSameAsCurrent = selectedCollectionId === (document?.collection_id ?? null)
  const isInCollection = !!(document?.collection_id)

  return (
    <>
      <Dialog open={open && !createOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Move to Collection</DialogTitle>
            <DialogDescription className="truncate">
              Moving: &ldquo;{document?.display_name}&rdquo;
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
            {isLoading ? (
              <>
                <Skeleton className="h-11 w-full rounded-md" />
                <Skeleton className="h-11 w-full rounded-md" />
                <Skeleton className="h-11 w-3/4 rounded-md" />
              </>
            ) : collections.length === 0 ? (
              /* ── Empty state ── */
              <div className="py-6 text-center space-y-3">
                <FolderOpen className="mx-auto size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No collections yet for this client.
                </p>
                <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                  Create a collection
                </Button>
              </div>
            ) : (
              /* ── Collection list ── */
              collections.map((col) => {
                const isCurrent = col.id === document?.collection_id
                const isSelected = col.id === selectedCollectionId

                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setSelectedCollectionId(col.id)}
                    className={cn(
                      'w-full flex items-center justify-between rounded-md px-3 py-2.5 text-sm text-left transition-colors',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent',
                    )}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Folder
                        className={cn(
                          'size-4 shrink-0',
                          isSelected ? 'text-primary-foreground' : 'text-muted-foreground',
                        )}
                      />
                      <span className="font-medium truncate">{col.name}</span>
                    </span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {isCurrent && (
                        <span
                          className={cn(
                            'text-xs font-medium',
                            isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground',
                          )}
                        >
                          Current
                        </span>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Remove from collection link */}
          {isInCollection && collections.length > 0 && (
            <div className="pt-1">
              {confirmRemove ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Are you sure? The document will become ungrouped.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmRemove(false)}
                      disabled={moveMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => moveMutation.mutate(null)}
                      disabled={moveMutation.isPending}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline hover:text-foreground transition-colors"
                  onClick={() => setConfirmRemove(true)}
                >
                  Remove from collection
                </button>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={moveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => moveMutation.mutate(selectedCollectionId)}
              disabled={
                isSameAsCurrent ||
                selectedCollectionId === null ||
                moveMutation.isPending ||
                collections.length === 0
              }
            >
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inline create collection — launched from empty state */}
      <CreateCollectionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        clientId={document?.client_id}
      />
    </>
  )
}
