import { useState } from 'react'
import { format } from 'date-fns'
import { ClipboardList, ChevronRight } from 'lucide-react'
import { useTasksForPost } from '@/api/tasks'
import { usePermissions } from '@/api/usePermissions'
import {
  TaskDetailSheet,
  STATUS_CONFIG,
  STATUS_DOT,
  PRIORITY_CONFIG,
} from '@/components/tasks/TaskCard'
import { useTaskLookups } from '@/components/tasks/useTaskLookups'
import { cn } from '@/lib/utils'

/**
 * Reverse view of task→deliverable linking: the tasks that reference this
 * deliverable. Renders nothing when there are none, so it never adds noise to
 * posts without linked work.
 *
 * Rows stay compact — client and campaign are already in the deliverable's
 * meta column, so repeating them here would be noise. Clicking a row opens
 * TaskDetailSheet in place rather than navigating to /tasks, so a status
 * change or edit never costs the user their place on the deliverable.
 *
 * postId must be the real posts.id (post.actual_post_id).
 */
export default function PostLinkedTasks({ postId }) {
  const { data: tasks = [], isLoading } = useTasksForPost(postId)
  const { clientMap, campaignMap, memberMap, currentUserId } = useTaskLookups()
  const { isOwner } = usePermissions()
  const [selectedTask, setSelectedTask] = useState(null)

  if (isLoading || tasks.length === 0) return null

  // Mirrors TaskCard's gating: the owner or the task's creator may edit; the
  // assignee may additionally toggle status.
  const isCreator = selectedTask?.created_by === currentUserId
  const isAssignee = selectedTask?.assigned_to === currentUserId

  return (
    <div className="pt-4">
      <div className="flex items-center gap-2 mb-2">
        <ClipboardList className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Linked tasks</h3>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {tasks.map((task) => {
          const statusCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.TODO
          const priorityCfg = PRIORITY_CONFIG[task.priority]
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => setSelectedTask(task)}
              className="group flex w-full items-center gap-2.5 rounded-lg border border-border/50 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
            >
              {priorityCfg && (
                <span
                  className={cn('size-2 rounded-full shrink-0', priorityCfg.dot)}
                  title={`${priorityCfg.label} priority`}
                />
              )}
              <span
                className={cn(
                  'text-sm truncate flex-1 min-w-0',
                  task.status === 'COMPLETED' && 'line-through text-muted-foreground',
                )}
              >
                {task.title}
              </span>
              {task.due_at && (
                <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                  {format(new Date(task.due_at), 'd MMM')}
                </span>
              )}
              <span
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium shrink-0',
                  statusCfg.className,
                )}
              >
                <span className={cn('size-1.5 rounded-full shrink-0', STATUS_DOT[task.status])} />
                {statusCfg.label}
              </span>
              <ChevronRight className="size-4 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground transition-colors" />
            </button>
          )
        })}
      </div>

      <TaskDetailSheet
        task={selectedTask}
        open={!!selectedTask}
        onOpenChange={(open) => { if (!open) setSelectedTask(null) }}
        clientMap={clientMap}
        campaignMap={campaignMap}
        memberMap={memberMap}
        currentUserId={currentUserId}
        canEdit={isOwner || isCreator}
        canToggle={isOwner || isCreator || isAssignee}
      />
    </div>
  )
}
