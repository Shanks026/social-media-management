import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import {
  FileText,
  Image,
  FileSpreadsheet,
  FileArchive,
  Video,
  File,
  Download,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  MoreHorizontal,
  Eye,
  FolderInput,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  deleteDocument,
  updateDocument,
  archiveDocument,
  unarchiveDocument,
  getDocumentSignedUrl,
} from '@/api/documents'
import { formatDate, formatFileSize } from '@/lib/helper'
import DocumentCategoryBadge from './DocumentCategoryBadge'
import { DOCUMENT_CATEGORIES } from './UploadMetaDialog'
import { useAuth } from '@/context/AuthContext'
import { Building2, Lock } from 'lucide-react'
import DocumentPreviewModal from './DocumentPreviewModal'
import MoveToCollectionDialog from './MoveToCollectionDialog'
import { useSubscription } from '@/api/useSubscription'

function getFileIcon(mimeType) {
  if (!mimeType) return File
  if (mimeType.startsWith('image/')) return Image
  if (mimeType === 'application/pdf') return FileText
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv'))
    return FileSpreadsheet
  if (mimeType.startsWith('video/')) return Video
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return FileArchive
  return FileText
}

const editSchema = z.object({
  displayName: z.string().min(1, 'Name is required').max(200),
  category: z.string().min(1, 'Category is required'),
  notes: z.string().max(500).optional(),
})

export default function DocumentCard({ doc }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: sub } = useSubscription()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)

  const Icon = getFileIcon(doc.mime_type)

  const form = useForm({
    resolver: zodResolver(editSchema),
    defaultValues: {
      displayName: doc.display_name,
      category: doc.category,
      notes: doc.notes ?? '',
    },
  })

  // ── Delete ──
  const deleteMutation = useMutation({
    mutationFn: () =>
      deleteDocument({
        id: doc.id,
        storagePath: doc.storage_path,
        fileSizeBytes: doc.file_size_bytes,
        userId: user.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'list'] })
      toast.success('Document deleted')
    },
    onError: (err) => toast.error(err.message || 'Failed to delete document'),
  })

  // ── Update ──
  const updateMutation = useMutation({
    mutationFn: (values) =>
      updateDocument(doc.id, {
        displayName: values.displayName,
        category: values.category,
        notes: values.notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'list'] })
      setEditOpen(false)
      toast.success('Document updated')
    },
    onError: (err) => toast.error(err.message || 'Failed to update document'),
  })

  // ── Archive ──
  const archiveMutation = useMutation({
    mutationFn: () => archiveDocument(doc.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'list'] })
      toast.success('Document archived')
    },
    onError: (err) => toast.error(err.message || 'Failed to archive document'),
  })

  // ── Unarchive ──
  const unarchiveMutation = useMutation({
    mutationFn: () => unarchiveDocument(doc.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'list'] })
      toast.success('Document restored')
    },
    onError: (err) => toast.error(err.message || 'Failed to restore document'),
  })

  // ── Download ──
  async function handleDownload() {
    try {
      const url = await getDocumentSignedUrl(doc.storage_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error(err.message || 'Failed to generate download link')
    }
  }

  function openEditDialog() {
    form.reset({
      displayName: doc.display_name,
      category: doc.category,
      notes: doc.notes ?? '',
    })
    setEditOpen(true)
  }

  const isArchived = doc.status === 'Archived'

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 px-4 py-3 transition-colors',
          isArchived
            ? 'opacity-50'
            : 'hover:bg-accent/30',
        )}
      >
        {/* Icon */}
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="size-4 text-muted-foreground" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <button
              className="text-sm font-medium truncate text-left hover:underline hover:text-primary transition-colors"
              onClick={() => setPreviewOpen(true)}
            >
              {doc.display_name}
            </button>
            <DocumentCategoryBadge category={doc.category} className="shrink-0" />
            {isArchived && (
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                Archived
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {doc.original_filename && (
              <>
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  {doc.original_filename.split('.').pop()}
                </span>
                <span className="text-xs text-muted-foreground">·</span>
              </>
            )}
            <span className="text-xs text-muted-foreground">
              {formatFileSize(doc.file_size_bytes)}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              {formatDate(doc.created_at)}
            </span>
          </div>
          {doc.notes && (
            <p className="text-xs text-muted-foreground/70 truncate max-w-sm">
              {doc.notes}
            </p>
          )}
        </div>

        {/* Client or prospect — avatar + name, far right */}
        {(doc.clients?.name || doc.prospects?.business_name) && (
          <div className="flex items-center gap-1.5 shrink-0 mr-1">
            {doc.clients?.logo_url ? (
              <img
                src={doc.clients.logo_url}
                alt=""
                className="size-5 rounded-full object-cover ring-1 ring-border"
              />
            ) : (
              <div className="size-5 rounded-full bg-muted flex items-center justify-center ring-1 ring-border">
                <Building2 className="size-3 text-muted-foreground" />
              </div>
            )}
            <span className="text-xs font-medium text-muted-foreground max-w-28 truncate">
              {doc.clients?.name ?? doc.prospects?.business_name}
            </span>
          </div>
        )}

        {/* Actions */}
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => setPreviewOpen(true)}
        >
          <Eye className="size-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 shrink-0">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDownload}>
              <Download className="size-4" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openEditDialog}>
              <Pencil className="size-4" />
              Rename / Recategorise
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setMoveDialogOpen(true)}
              disabled={!sub?.documents_collections}
              className={!sub?.documents_collections ? 'opacity-50 cursor-not-allowed' : ''}
            >
              <FolderInput className="size-4" />
              Move to Collection
              {!sub?.documents_collections && <Lock size={12} className="ml-auto" />}
            </DropdownMenuItem>
            {isArchived ? (
              <DropdownMenuItem
                onClick={() => unarchiveMutation.mutate()}
                disabled={unarchiveMutation.isPending}
              >
                <ArchiveRestore className="size-4" />
                Restore
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => archiveMutation.mutate()}
                disabled={archiveMutation.isPending}
              >
                <Archive className="size-4" />
                Archive
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{doc.display_name}&rdquo; will be permanently removed from
              storage. This cannot be undone.
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

      {/* Move to Collection dialog */}
      <MoveToCollectionDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        document={doc}
      />

      {/* Preview modal */}
      <DocumentPreviewModal
        doc={previewOpen ? doc : null}
        onOpenChange={(open) => setPreviewOpen(open)}
      />

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit document</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => updateMutation.mutate(values))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Q1 Contract"
                        disabled={updateMutation.isPending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={updateMutation.isPending}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DOCUMENT_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Notes{' '}
                      <span className="text-muted-foreground font-normal">(Optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any context or notes about this document…"
                        className="resize-none text-sm"
                        rows={3}
                        disabled={updateMutation.isPending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOpen(false)}
                  disabled={updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
