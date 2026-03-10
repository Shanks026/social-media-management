import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Folder,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { deleteCollection, documentKeys } from '@/api/documents'
import { formatDate } from '@/lib/helper'
import DocumentCard from './DocumentCard'
import CreateCollectionDialog from './CreateCollectionDialog'
import DocumentUploadZone from './DocumentUploadZone'
import UploadMetaDialog from './UploadMetaDialog'
import { useMutation as useUploadMutation } from '@tanstack/react-query'
import { uploadDocument } from '@/api/documents'
import { useAuth } from '@/context/AuthContext'
import { Accordion, AccordionItem, AccordionContent } from '@/components/ui/accordion'
import { Accordion as AccordionPrimitive } from 'radix-ui'
import { Lock } from 'lucide-react'

/**
 * Expandable collection card showing documents grouped inside.
 *
 * Props:
 *   collection   — collection object { id, name, description, client_id, created_at }
 *   documents    — array of documents belonging to this collection
 */
export default function CollectionCard({ collection, documents = [], locked = false }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // ── Upload within this collection ──
  const [pendingFile, setPendingFile] = useState(null)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)

  const uploadMutation = useUploadMutation({
    mutationFn: ({ file, displayName, category }) =>
      uploadDocument({
        clientId: collection.client_id,
        file,
        displayName,
        category,
        collectionId: collection.id,
      }),
    onMutate: () => setUploadProgress(10),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'list'] })
      setUploadProgress(100)
      setTimeout(() => {
        setUploadProgress(null)
        setUploadDialogOpen(false)
        setPendingFile(null)
      }, 400)
      toast.success('Document uploaded')
    },
    onError: (err) => {
      setUploadProgress(null)
      toast.error(err.message || 'Upload failed')
    },
  })

  function handleFileSelected(file) {
    setPendingFile(file)
    setUploadDialogOpen(true)
  }

  function handleConfirmUpload({ displayName, category }) {
    if (!pendingFile) return
    setUploadProgress(30)
    uploadMutation.mutate({ file: pendingFile, displayName, category })
  }

  function handleUploadDialogClose(open) {
    if (!open && uploadProgress === null) {
      setUploadDialogOpen(false)
      setPendingFile(null)
    }
  }

  // ── Delete collection ──
  const deleteMutation = useMutation({
    mutationFn: () => deleteCollection(collection.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.collections(collection.client_id) })
      queryClient.invalidateQueries({ queryKey: documentKeys.allCollections() })
      queryClient.invalidateQueries({ queryKey: ['documents', 'list'] })
      toast.success('Collection deleted — documents moved to ungrouped')
    },
    onError: (err) => toast.error(err.message || 'Failed to delete collection'),
  })

  const count = documents.length

  return (
    <div className={cn('relative', locked && 'opacity-50 pointer-events-none select-none')}>
      {locked && (
        <div className="absolute top-2.5 right-10 z-10">
          <Lock size={12} className="text-muted-foreground" />
        </div>
      )}
      <Accordion
        type="single" 
        collapsible 
        value={expanded ? "collection" : ""} 
        onValueChange={(val) => setExpanded(val === "collection")}
        className="w-full"
      >
        <AccordionItem value="collection" className="rounded-xl border border-border/60 bg-card overflow-hidden data-[state=open]:border-border/60">
          {/* ── Header ── */}
          <AccordionPrimitive.Header className="flex m-0">
            <AccordionPrimitive.Trigger
              className="flex w-full items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/20 transition-colors select-none focus-visible:outline-none focus-visible:bg-accent/20 [&[data-state=open]_.chevron]:rotate-90"
            >
              {/* Chevron */}
              <div className="text-muted-foreground shrink-0 transition-transform duration-200 chevron">
                <ChevronRight className="size-4" />
              </div>

          {/* Folder icon */}
          <div className="shrink-0 text-primary/60">
            {expanded
              ? <FolderOpen className="size-5" />
              : <Folder className="size-5" />}
          </div>

          {/* Name + description */}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium truncate">{collection.name}</p>
            {collection.description && (
              <p className="text-xs text-muted-foreground truncate">{collection.description}</p>
            )}
          </div>

          {/* Document count + date */}
          <span className="text-xs text-muted-foreground shrink-0">
            {count} {count === 1 ? 'document' : 'documents'}
          </span>
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
            {formatDate(collection.created_at)}
          </span>

          {/* Actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => {
              e.stopPropagation()
            }}>
              <Button variant="ghost" size="icon" className="size-7 shrink-0">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  setRenameOpen(true)
                }}
              >
                <Pencil className="size-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteOpen(true)
                }}
              >
                <Trash2 className="size-4" />
                Delete collection
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>

          {/* ── Expanded body ── */}
          <AccordionContent className="pb-0" forceMount={false}>
            <div className="border-t border-border/40 bg-muted/20 px-4 py-4 space-y-3">
              {/* Upload zone for this collection */}
              <DocumentUploadZone
                onFileSelected={handleFileSelected}
                disabled={uploadMutation.isPending}
                compact
              />

              {/* Documents */}
              {documents.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4 italic">
                  This collection is empty. Upload a document above to add it here.
                </p>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <DocumentCard key={doc.id} doc={doc} />
                  ))}
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Rename dialog */}
      <CreateCollectionDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        clientId={collection.client_id}
        editCollection={collection}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{collection.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              The collection will be removed. All documents inside will remain and become ungrouped.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upload dialog */}
      <UploadMetaDialog
        open={uploadDialogOpen}
        onOpenChange={handleUploadDialogClose}
        file={pendingFile}
        onConfirm={handleConfirmUpload}
        uploadProgress={uploadProgress}
      />
    </div>
  )
}
