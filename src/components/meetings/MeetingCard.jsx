import { useState } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Clock,
  Lock,
  Users,
  Link as LinkIcon,
  CheckCircle2,
  RotateCcw,
  Pencil,
  Trash2,
} from 'lucide-react'
import { format, isPast } from 'date-fns'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  deleteMeeting,
  markMeetingCompleted,
  unmarkMeetingCompleted,
} from '@/api/meetings'
import CreateMeetingDialog from '@/components/CreateMeetingDialog'
import { ClientAvatar } from '@/components/tasks/ClientAvatar'
import { cn } from '@/lib/utils'

/**
 * Shared meeting card used by the global Meetings page and the reusable
 * MeetingsTab (client- and campaign-scoped). Invalidates every meetings query
 * key so all surfaces refresh regardless of which one triggered the mutation.
 */
export default function MeetingCard({ meeting, clientMap = {} }) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['global-meetings'] })
    queryClient.invalidateQueries({ queryKey: ['meetings'] })
    queryClient.invalidateQueries({ queryKey: ['campaign-meetings'] })
  }

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteMeeting(meeting.id),
    onSuccess: () => {
      invalidate()
      toast.success('Meeting deleted')
    },
    onError: (err) => toast.error('Failed to delete meeting: ' + err.message),
  })

  const { mutate: markDone, isPending: isMarkingDone } = useMutation({
    mutationFn: () => markMeetingCompleted(meeting.id),
    onSuccess: () => {
      invalidate()
      toast.success('Meeting marked as completed')
    },
    onError: (err) => toast.error('Failed to update meeting: ' + err.message),
  })

  const { mutate: unmarkDone, isPending: isUnmarkingDone } = useMutation({
    mutationFn: () => unmarkMeetingCompleted(meeting.id),
    onSuccess: () => {
      invalidate()
      toast.success('Meeting restored')
    },
    onError: (err) => toast.error('Failed to update meeting: ' + err.message),
  })

  const isBusy = isDeleting || isMarkingDone || isUnmarkingDone
  const isCompleted = Boolean(meeting.completed_at)
  const isMeetingPast = isPast(new Date(meeting.datetime))
  const client = clientMap[meeting.client_id]

  return (
    <>
      <div
        className={cn(
          'group flex flex-col bg-card/50 rounded-xl shadow-sm ring-1 ring-border/50 overflow-hidden transition-all hover:shadow-md',
          isMeetingPast && !isCompleted && 'opacity-60',
          isCompleted && 'opacity-50',
        )}
      >
        <div className="px-5 pt-5 pb-4 flex flex-col flex-1">
          <div className="flex items-start gap-4 w-full">
            {/* ── DATE SQUARE BLOCK ── */}
            <div className="flex flex-col items-center justify-center w-12 h-12 shrink-0 rounded-lg border border-border bg-muted/40 transition-colors group-hover:bg-muted/60 mt-0.5">
              <span className="text-[10px] font-medium text-muted-foreground leading-none tracking-wider mb-1">
                {format(new Date(meeting.datetime), 'MMM').toUpperCase()}
              </span>
              <span className="text-lg font-bold text-foreground leading-none">
                {format(new Date(meeting.datetime), 'dd')}
              </span>
            </div>

            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2 mt-1">
                <p
                  className={cn(
                    'text-sm font-semibold leading-snug line-clamp-2',
                    (isMeetingPast || isCompleted) && 'text-muted-foreground',
                    isCompleted && 'line-through',
                  )}
                >
                  {meeting.title}
                </p>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] px-2 py-0.5 shrink-0 font-medium border-transparent mt-0.5',
                    isCompleted
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : isMeetingPast
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                  )}
                >
                  {isCompleted
                    ? 'Completed'
                    : isMeetingPast
                      ? 'Missed'
                      : 'Upcoming'}
                </Badge>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mt-1.5">
                <Clock className="size-3.5 shrink-0" />
                {format(new Date(meeting.datetime), 'h:mm a')}
                {meeting.visibility === 'private' && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <Lock className="size-3 shrink-0" />
                    <span>Private</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 flex-1">
            {meeting.notes ? (
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {meeting.notes}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground/50 italic line-clamp-2 leading-relaxed">
                No notes
              </p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-dashed border-border/60">
            <div className="flex flex-wrap items-center justify-between gap-2 pl-1">
              {client ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <ClientAvatar client={client} size="sm" />
                  <span className="text-xs font-medium text-foreground truncate max-w-[120px]">
                    {client.name}
                  </span>
                  {client.is_internal && (
                    <Badge
                      variant="secondary"
                      className="text-[9px] px-1 py-0 shrink-0"
                    >
                      INT
                    </Badge>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-muted-foreground/50 italic text-[10px]">
                  <Users className="size-3" />
                  <span>No client linked</span>
                </div>
              )}
              {meeting.meeting_link && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-primary px-2 -mr-2"
                      onClick={() =>
                        window.open(meeting.meeting_link, '_blank')
                      }
                    >
                      <LinkIcon className="h-3 w-3" />
                      Meet Link
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="max-w-[260px] break-all text-xs"
                  >
                    {meeting.meeting_link}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center gap-1 px-4 py-2.5 border-t border-border/40 bg-muted/20">
          {isCompleted ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-primary gap-1.5"
              onClick={() => unmarkDone()}
              disabled={isBusy}
            >
              <RotateCcw className="size-3.5" /> Restore
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-emerald-600 gap-1.5"
              onClick={() => markDone()}
              disabled={isBusy}
              title="Mark as done"
            >
              <CheckCircle2 className="size-3.5" /> Mark as Done
            </Button>
          )}

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-primary"
            onClick={() => setEditOpen(true)}
            disabled={isBusy || isCompleted}
            title="Edit"
          >
            <Pencil className="size-3.5" />
          </Button>
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

      <CreateMeetingDialog
        editMeeting={meeting}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={invalidate}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete meeting?</AlertDialogTitle>
            <AlertDialogDescription>
              "{meeting.title}" will be permanently deleted. This cannot be
              undone.
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
