import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Archive, RotateCcw, Trash2, PencilRuler } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import {
  useTaskById,
  useTaskExists,
  useTaskActivity,
  useTaskWatchers,
  updateTaskStatus,
  reassignTask,
  deleteTask,
  fetchTaskDeliverables,
} from '@/api/tasks'
import { usePermissions } from '@/api/usePermissions'
import { useHeader } from '@/components/misc/header-context'
import { useTaskLookups } from '@/components/tasks/useTaskLookups'
import { STATUS_CONFIG, STATUS_DOT, PRIORITY_CONFIG, DeliverablePreviewRow } from '@/components/tasks/TaskCard'
import EditTaskDialog from '@/components/tasks/EditTaskDialog'
import { CommentThread } from '@/components/comments/CommentThread'
import TaskMetaRail from './TaskMetaRail'
import TaskActivityFeed from './TaskActivityFeed'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
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

/**
 * `/tasks/:taskId` — the task as a linkable page; every task surface
 * navigates straight here (no in-place peek any more) — notifications, chat
 * references, a deliverable's linked-task rows, and every task list/board.
 *
 * The three ways a task can fail to render are kept distinct on purpose:
 * still loading, genuinely deleted, or existing but outside this member's
 * `tasks_select` scope. The last one is the reason `useTaskExists` is here —
 * a blank "not found" for a task that does exist would be misleading, and
 * ChatEntityCard already draws the same distinction for chat references.
 */
export default function TaskDetailPage() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { setHeader } = useHeader()
  const { isAdmin } = usePermissions()
  const { clientMap, campaignMap, memberMap, currentUserId } = useTaskLookups()

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: task, isLoading, error } = useTaskById(taskId)
  const { data: activity = [], isLoading: isLoadingActivity } = useTaskActivity(taskId)
  const watcherIds = useTaskWatchers(task)

  // Only asked once we know the row isn't visible — it answers "does this id
  // exist at all", nothing about its contents.
  const { data: existsElsewhere, isLoading: isCheckingExists } = useTaskExists(taskId, {
    enabled: !isLoading && !task,
  })

  const { data: linkedPosts = [], isLoading: isLoadingPosts } = useQuery({
    queryKey: ['task-deliverables', taskId],
    queryFn: () => fetchTaskDeliverables(taskId),
    enabled: !!taskId && !!task,
  })

  // Every task mutation can move the list, the detail row and the activity
  // feed at once, so all three invalidate together.
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tasks'], exact: false })

  const { mutate: setStatus, isPending: isSettingStatus } = useMutation({
    mutationFn: (next) => updateTaskStatus(taskId, next),
    onSuccess: invalidate,
    onError: (err) => toast.error('Failed to update: ' + err.message),
  })

  const { mutate: reassign, isPending: isReassigning } = useMutation({
    mutationFn: (next) => reassignTask(taskId, next),
    onSuccess: invalidate,
    onError: (err) => toast.error('Failed to reassign: ' + err.message),
  })

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteTask(taskId),
    onSuccess: () => {
      invalidate()
      toast.success('Task deleted')
      navigate('/tasks')
    },
    onError: (err) => toast.error('Failed to delete: ' + err.message),
  })

  const client = task?.client_id ? clientMap[String(task.client_id)] : null
  const campaign = task?.campaign_id ? campaignMap[String(task.campaign_id)] : null

  // Who assigned the current holder: the latest 'assigned' row's actor,
  // falling back to the creator for a task that has never been reassigned.
  const assignerId = useMemo(() => {
    if (!task) return null
    return activity.find((row) => row.type === 'assigned')?.actor_user_id ?? task.created_by
  }, [activity, task])

  useEffect(() => {
    if (!task) return
    setHeader({
      breadcrumbs: [{ label: 'Tasks & Todos', href: '/tasks' }, { label: task.title }],
    })
  }, [task, setHeader])

  if (isLoading || (!task && isCheckingExists)) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-2/3 max-w-md" />
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="min-w-0 space-y-3 lg:w-2/3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-40 w-full" />
          </div>
          <div className="w-full space-y-3 lg:w-1/3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return <p className="p-8 text-center text-destructive">{error.message || 'Failed to load this task.'}</p>
  }

  if (!task) {
    return (
      <div className="p-6">
        <Empty>
          <EmptyMedia>
            <span className="text-5xl">{existsElsewhere ? '🔒' : '🗑️'}</span>
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="font-bold text-xl">
              {existsElsewhere ? "You don't have access to this task" : 'Task not found'}
            </EmptyTitle>
            <EmptyDescription>
              {existsElsewhere
                ? 'Tasks are visible to their creator, their assignees and workspace admins. Ask whoever owns it to assign or reassign it to you.'
                : 'This task may have been deleted. It is no longer in your workspace.'}
            </EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" onClick={() => navigate('/tasks')}>
            Back to tasks
          </Button>
        </Empty>
      </div>
    )
  }

  const isCreator = task.created_by === currentUserId
  const isAssignee = task.assigned_to === currentUserId
  // isAdmin already means owner OR admin OR superadmin (matches the DB's
  // is_workspace_admin(), which update_task_status/reassign_task actually
  // check) — this was isOwner alone, so an admin who reassigned a task away
  // from themselves lost canToggle/canEdit in the UI even though the RPCs
  // would still have allowed them. Same fix in TaskCard.jsx below.
  const canEdit = isAdmin || isCreator
  const canToggle = canEdit || isAssignee
  // Handing work on isn't the same permission as rewriting the task. The
  // `reassign_task` RPC is the real gate; this only decides whether to
  // render the picker.
  //
  // Includes past assignees too, matching reassign_task's own access check
  // (creator, current assignee, ANY past assignee, or admin) — this had
  // drifted to current-assignee-only, which meant handing a task off cost you
  // every control over it, with no way to take back a mistaken handoff.
  const wasPastAssignee = activity.some(
    (row) => row.type === 'assigned' && row.to_user_id === currentUserId,
  )
  const canReassign = canEdit || isAssignee || wasPastAssignee

  const isBusy = isSettingStatus || isReassigning || isDeleting
  const statusCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.TODO
  const priorityCfg = PRIORITY_CONFIG[task.priority]

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Title block + record-level actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn('gap-1.5 select-none', statusCfg.className)}>
              <span className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[task.status] ?? 'bg-zinc-400')} />
              {statusCfg.label}
            </Badge>
            {priorityCfg && (
              <Badge variant="outline" className="gap-1.5">
                <span className={cn('size-2 shrink-0 rounded-full', priorityCfg.dot)} />
                {priorityCfg.label}
              </Badge>
            )}
          </div>
          <h1
            className={cn(
              'text-2xl font-bold leading-snug',
              task.status === 'COMPLETED' && 'text-muted-foreground line-through',
            )}
          >
            {task.title}
          </h1>
        </div>

        {canEdit && (
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} disabled={isBusy}>
              <Pencil className="mr-1.5 size-3.5" /> Edit
            </Button>
            {task.status !== 'ARCHIVED' ? (
              <Button variant="outline" size="sm" onClick={() => setStatus('ARCHIVED')} disabled={isBusy}>
                <Archive className="mr-1.5 size-3.5" /> Archive
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setStatus('TODO')} disabled={isBusy}>
                <RotateCcw className="mr-1.5 size-3.5" /> Restore
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
              disabled={isBusy}
            >
              <Trash2 className="mr-1.5 size-3.5" /> Delete
            </Button>
          </div>
        )}
      </div>

      {/* Body split: description + tabs on the left, meta rail on the right.
          The rail is narrower than the deliverable detail page's — a task's
          meta is a handful of short rows (status, assignee, due date),
          nowhere near the deliverable page's platform badges and publish
          plan, so it doesn't need a third of the page. */}
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="min-w-0 space-y-6 lg:w-[70%]">
          {task.description && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{task.description}</p>
          )}

          <Tabs defaultValue="deliverables">
            <TabsList>
              <TabsTrigger value="deliverables">
                Deliverables
                {linkedPosts.length > 0 && (
                  <span className="ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
                    {linkedPosts.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="comments">Comments</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="deliverables" className="pt-4">
              {isLoadingPosts ? (
                <div className="flex flex-col gap-2">
                  {[0, 1].map((i) => (
                    <Skeleton key={i} className="h-18 rounded-lg" />
                  ))}
                </div>
              ) : linkedPosts.length === 0 ? (
                <Empty>
                  <EmptyMedia>
                    <span className="text-5xl">📦</span>
                  </EmptyMedia>
                  <EmptyHeader>
                    <EmptyTitle className="font-bold text-xl">No deliverables linked</EmptyTitle>
                    <EmptyDescription>
                      {canEdit
                        ? 'Link deliverables from Edit to keep this task and the work it covers together.'
                        : 'Nothing has been linked to this task yet.'}
                    </EmptyDescription>
                  </EmptyHeader>
                  {canEdit && (
                    <Button variant="outline" onClick={() => setEditOpen(true)}>
                      <PencilRuler className="mr-1.5 size-3.5" /> Link deliverables
                    </Button>
                  )}
                </Empty>
              ) : (
                <div className="flex flex-col gap-2">
                  {linkedPosts.map((post) => (
                    <DeliverablePreviewRow
                      key={post.id}
                      post={post}
                      // A General (clientless) task can link work across any
                      // client, so those rows need labelling.
                      client={!task.client_id ? clientMap?.[String(post.client_id)] : undefined}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* composerPosition="top": the YouTube/Jira layout — composer
                first, newest comment right under it, no fixed-height box at
                all, the tab's own content area just scrolls with the page
                like every other tab here. The composer itself is the same
                InputGroup field posts/campaigns use — a from-scratch
                minimal single-row field was tried and reverted. Two boxed/
                height-managed attempts (a flat 600px box, then a viewport-
                measured sticky-bottom composer) were tried and dropped too
                — natural page flow needed none of it. Trial on tasks first,
                before touching posts/campaigns. */}
            <TabsContent value="comments" className="pt-4">
              <CommentThread entityType="task" entityId={task.id} composerPosition="top" />
            </TabsContent>

            <TabsContent value="activity" className="pt-4">
              <TaskActivityFeed
                activity={activity}
                isLoading={isLoadingActivity}
                memberMap={memberMap}
                currentUserId={currentUserId}
              />
            </TabsContent>
          </Tabs>
        </div>

        <TaskMetaRail
          task={{ ...task, assigner_id: assignerId }}
          client={client}
          campaign={campaign}
          memberMap={memberMap}
          currentUserId={currentUserId}
          watcherIds={watcherIds}
          canToggle={canToggle}
          canReassign={canReassign}
          onStatusChange={setStatus}
          onReassign={reassign}
          isBusy={isBusy}
        />
      </div>

      <EditTaskDialog task={task} open={editOpen} onOpenChange={setEditOpen} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              "{task.title}" will be permanently deleted. This cannot be undone.
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
    </div>
  )
}
