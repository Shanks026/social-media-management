import { useState, useMemo } from 'react'
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
        className={`${dim} rounded-full object-cover ring-1 ring-border shrink-0`}
      />
    )
  }
  return (
    <div
      className={`${dim} rounded-full bg-muted flex items-center justify-center shrink-0`}
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
 *  - variant       — 'row' (default), 'dashboard-card' (dashboard), 'client-card' (client explicit card)
 */
export default function NoteRow({
  note,
  clientMap = {},
  showClient = false,
  variant = 'row',
}) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['global-notes'] })
    queryClient.invalidateQueries({
      queryKey: ['client-notes', note.client_id],
    })
  }

  const { mutate: setStatus, isPending: isSettingStatus } = useMutation({
    mutationFn: (newStatus) => updateNoteStatus(note.id, newStatus),
    onSuccess: invalidate,
    onError: (err) => toast.error('Failed to update note: ' + err.message),
  })

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteNote(note.id),
    onSuccess: () => {
      invalidate()
      toast.success('Note deleted')
    },
    onError: (err) => toast.error('Failed to delete note: ' + err.message),
  })

  const isBusy = isSettingStatus || isDeleting

  const overdue = useMemo(() => {
    if (!note.due_at || note.status !== 'TODO') return false
    return new Date(note.due_at).getTime() < Date.now()
  }, [note.due_at, note.status])

  const client = clientMap[note.client_id]

  const handleCircleClick = () => {
    if (note.status === 'TODO') setStatus('DONE')
    else if (note.status === 'DONE') setStatus('TODO')
  }

  const isCard = variant === 'dashboard-card' || variant === 'client-card'

  // ─── Card Modes ───────────────────────────────────────────────────────────
  if (isCard) {
    return (
      <>
        <div className="@container group bg-white dark:bg-card/50 rounded-2xl shadow-sm ring-1 ring-border/50 overflow-hidden">
          {/* Main content */}
          <div className="px-5 pt-5 pb-4">
            {/* Title row */}
            <div className="flex items-start gap-3 mb-1">
              {note.status !== 'ARCHIVED' ? (
                <button
                  onClick={handleCircleClick}
                  disabled={isBusy}
                  className="mt-0.5 shrink-0 text-foreground hover:text-primary transition-colors disabled:opacity-50"
                >
                  {note.status === 'TODO' ? (
                    <Circle className="size-5 stroke-[2]" />
                  ) : (
                    <CheckCircle2 className="size-5 text-emerald-500 stroke-[2]" />
                  )}
                </button>
              ) : (
                <div className="size-5 mt-0.5 shrink-0" />
              )}
              <p
                className={`font-medium text-sm leading-snug ${
                  note.status !== 'TODO'
                    ? 'line-through text-muted-foreground'
                    : 'text-foreground'
                }`}
              >
                {note.title}
              </p>
            </div>

            {/* Description */}
            {note.content && (
              <p className="text-xs text-muted-foreground line-clamp-2 pl-8">
                {note.content}
              </p>
            )}

            {/* Divider */}
            <div className="border-t border-dashed border-border/60 mt-4 mb-3" />

            {/* Footer: client(dashboard) or actions(client-card) + due date */}
            <div className="flex items-center justify-between pl-1">
              {variant === 'dashboard-card' && client ? (
                <div className="flex items-center gap-2">
                  <ClientAvatar client={client} size="sm" />
                  <span className="text-xs font-semibold text-foreground truncate max-w-[140px] hidden @[300px]:block">
                    {client.name || 'Internal'}
                  </span>
                  {client.is_internal && (
                    <Badge
                      variant="secondary"
                      className="text-[9px] px-1 py-0 hidden @[300px]:inline-flex"
                    >
                      INT
                    </Badge>
                  )}
                </div>
              ) : variant === 'client-card' ? (
                <div className="flex items-center gap-1 -ml-3">
                  {note.status === 'ARCHIVED' ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-primary transition-colors hover:bg-muted/50"
                      onClick={() => setStatus('TODO')}
                      disabled={isBusy}
                      title="Restore"
                    >
                      <RotateCcw className="size-3.5" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-amber-500 transition-colors hover:bg-muted/50"
                      onClick={() => setStatus('ARCHIVED')}
                      disabled={isBusy}
                      title="Archive"
                    >
                      <Archive className="size-3.5" />
                    </Button>
                  )}
                  {note.status !== 'ARCHIVED' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-primary transition-colors hover:bg-muted/50"
                      onClick={() => setEditOpen(true)}
                      disabled={isBusy}
                      title="Edit"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive transition-colors hover:bg-destructive/10"
                    onClick={() => setDeleteOpen(true)}
                    disabled={isBusy}
                    title="Delete"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <div />
              )}

              <div
                className={`flex items-center gap-1.5 text-xs font-medium ${
                  overdue ? 'text-destructive' : 'text-muted-foreground'
                }`}
              >
                <Bell className="size-3.5 shrink-0" />
                {note.due_at ? (
                  <>
                    <span>{format(new Date(note.due_at), 'dd MMMM yyyy')}</span>
                    <span className="w-1 h-1 rounded-full bg-current opacity-50" />
                    <span>{format(new Date(note.due_at), 'h:mma')}</span>
                    {overdue && (
                      <Badge
                        variant="destructive"
                        className="text-[9px] px-1 py-0 ml-1"
                      >
                        Overdue
                      </Badge>
                    )}
                  </>
                ) : (
                  <span>-</span>
                )}
              </div>
            </div>
          </div>

          {/* Hover action bar — only for dashboard-card */}
          {variant === 'dashboard-card' && (
            <div
              className="
                grid transition-all duration-200 ease-in-out
                delay-400 group-hover:delay-[400ms]
                grid-rows-[0fr] group-hover:grid-rows-[1fr]
              "
            >
              <div className="overflow-hidden">
                <div className="flex items-center gap-1 px-4 py-2 border-t border-border/40 bg-muted/30">
                  {note.status === 'ARCHIVED' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-primary gap-1.5"
                      onClick={() => setStatus('TODO')}
                      disabled={isBusy}
                    >
                      <RotateCcw className="size-3" /> Restore
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-amber-500 gap-1.5"
                      onClick={() => setStatus('ARCHIVED')}
                      disabled={isBusy}
                    >
                      <Archive className="size-3" /> Archive
                    </Button>
                  )}

                  {note.status !== 'ARCHIVED' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-primary gap-1.5"
                      onClick={() => setEditOpen(true)}
                      disabled={isBusy}
                    >
                      <Pencil className="size-3" /> Edit
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1.5"
                    onClick={() => setDeleteOpen(true)}
                    disabled={isBusy}
                  >
                    <Trash2 className="size-3" /> Delete
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <EditNoteDialog
          note={note}
          open={editOpen}
          onOpenChange={setEditOpen}
        />

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete note?</AlertDialogTitle>
              <AlertDialogDescription>
                "{note.title}" will be permanently deleted. This cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
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

  // ─── Row Mode (Client page / Notes page) ─────────────────────────────────
  return (
    <>
      <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors rounded-lg group">
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
          <div className="size-5 mt-0.5 shrink-0" />
        )}

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

        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {note.status === 'ARCHIVED' ? (
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

      <EditNoteDialog note={note} open={editOpen} onOpenChange={setEditOpen} />

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
