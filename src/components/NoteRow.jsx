import { useState } from 'react'
import { format } from 'date-fns'
import {
  Bell,
  Circle,
  CheckCircle2,
  Archive,
  RotateCcw,
  Pencil,
  Trash2,
  Building2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateNoteStatus, deleteNote } from '@/api/notes'
import { toast } from 'sonner'
import EditNoteDialog from '@/components/EditNoteDialog'

// ─── Lifecycle ────────────────────────────────────────────────────────────────
//  TODO  →  DONE  (check circle)
//  TODO  →  ARCHIVED  (archive button)
//  DONE  →  TODO  (uncheck)
//  DONE  →  ARCHIVED  (archive button)
//  ARCHIVED  →  TODO  (restore button)

// ─── Client Avatar ────────────────────────────────────────────────────────────

export function ClientAvatar({ client, size = 'sm' }) {
  const dim = size === 'sm' ? 'size-5' : 'size-7'
  if (client?.logo_url) {
    return (
      <img
        src={client.logo_url}
        alt=""
        className={`${dim} rounded object-cover ring-1 ring-border shrink-0`}
      />
    )
  }
  return (
    <div
      className={`${dim} rounded bg-muted flex items-center justify-center shrink-0`}
    >
      <Building2 className="size-3 text-muted-foreground" />
    </div>
  )
}

// ─── NoteRow ──────────────────────────────────────────────────────────────────

/**
 * Props:
 *  - note        — the note object
 *  - clientMap   — { [clientId]: client } — optional, omit on OverviewTab
 *  - showClient  — boolean, show the client chip (global page only)
 */
export default function NoteRow({ note, clientMap = {}, showClient = false }) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['global-notes'] })
    queryClient.invalidateQueries({
      queryKey: ['client-notes', note.client_id],
    })
  }

  // ── Status mutation ───────────────────────────────────────────────────────
  const { mutate: setStatus, isPending: isSettingStatus } = useMutation({
    mutationFn: (newStatus) => updateNoteStatus(note.id, newStatus),
    onSuccess: invalidate,
    onError: (err) => toast.error('Failed to update note: ' + err.message),
  })

  // ── Delete mutation ───────────────────────────────────────────────────────
  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteNote(note.id),
    onSuccess: () => {
      invalidate()
      toast.success('Note deleted')
    },
    onError: (err) => toast.error('Failed to delete note: ' + err.message),
  })

  const isBusy = isSettingStatus || isDeleting
  const overdue =
    note.due_at &&
    new Date(note.due_at).getTime() < Date.now() &&
    note.status === 'TODO'

  const client = clientMap[note.client_id]

  // ── Status toggle (circle button) ─────────────────────────────────────────
  // TODO → DONE, DONE → TODO, ARCHIVED has no circle (uses restore instead)
  const handleCircleClick = () => {
    if (note.status === 'TODO') setStatus('DONE')
    else if (note.status === 'DONE') setStatus('TODO')
  }

  return (
    <>
      <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors rounded-lg group">
        {/* Circle toggle — hidden for ARCHIVED */}
        {note.status !== 'ARCHIVED' ? (
          <button
            onClick={handleCircleClick}
            disabled={isBusy}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
          >
            {note.status === 'TODO' ? (
              <Circle className="size-5" />
            ) : (
              <CheckCircle2 className="size-5 text-emerald-500" />
            )}
          </button>
        ) : (
          /* Placeholder to keep content aligned */
          <div className="size-5 mt-0.5 shrink-0" />
        )}

        {/* Content */}
        <div
          className={`min-w-0 flex-1 ${note.status !== 'TODO' ? 'opacity-50' : ''}`}
        >
          <p
            className={`font-medium text-sm ${
              note.status !== 'TODO' ? 'line-through text-muted-foreground' : ''
            }`}
          >
            {note.title}
          </p>
          {note.content && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {note.content}
            </p>
          )}
          {note.due_at && (
            <div
              className={`flex items-center gap-1 mt-1.5 text-[10px] font-medium ${
                overdue ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              <Bell className="size-3" />
              {format(new Date(note.due_at), 'MMM d, h:mm a')}
              {overdue && (
                <Badge
                  variant="destructive"
                  className="text-[9px] px-1 py-0 ml-1"
                >
                  Overdue
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Client chip — global page only */}
        {showClient && client && (
          <div className="flex items-center gap-1.5 shrink-0 ml-2 bg-muted/60 rounded-full px-2 py-1">
            <ClientAvatar client={client} size="sm" />
            <span className="text-[11px] text-muted-foreground font-medium truncate max-w-[100px]">
              {client.name}
            </span>
            {client.is_internal && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0">
                INT
              </Badge>
            )}
          </div>
        )}

        {/* Action buttons — visible on hover */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {note.status === 'ARCHIVED' ? (
            /* Restore to TODO */
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-primary"
              onClick={() => setStatus('TODO')}
              disabled={isBusy}
              title="Restore to To Do"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          ) : (
            /* Archive */
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-amber-500"
              onClick={() => setStatus('ARCHIVED')}
              disabled={isBusy}
              title="Archive"
            >
              <Archive className="size-3.5" />
            </Button>
          )}

          {/* Edit — not available for ARCHIVED */}
          {note.status !== 'ARCHIVED' && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-primary"
              onClick={() => setEditOpen(true)}
              disabled={isBusy}
              title="Edit"
            >
              <Pencil className="size-3.5" />
            </Button>
          )}

          {/* Delete */}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={isBusy}
            title="Delete"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Edit dialog */}
      <EditNoteDialog note={note} open={editOpen} onOpenChange={setEditOpen} />

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>
              "{note.title}" will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => remove()}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
