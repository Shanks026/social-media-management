import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ClipboardList, ChevronRight } from 'lucide-react'
import { useTasksForPost } from '@/api/tasks'
import { STATUS_CONFIG, STATUS_DOT, PRIORITY_CONFIG } from '@/components/tasks/TaskCard'
import { cn } from '@/lib/utils'

/**
 * Reverse view of task→deliverable linking: the tasks that reference this
 * deliverable. Renders nothing when there are none, so it never adds noise to
 * posts without linked work.
 *
 * postId must be the real posts.id (post.actual_post_id).
 */
export default function PostLinkedTasks({ postId }) {
  const { data: tasks = [], isLoading } = useTasksForPost(postId)

  if (isLoading || tasks.length === 0) return null

  return (
    <div className="pt-4">
      <div className="flex items-center gap-2 mb-2">
        <ClipboardList className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Linked tasks</h3>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {tasks.map((task) => {
          const statusCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.TODO
          const priorityCfg = PRIORITY_CONFIG[task.priority]
          return (
            <Link
              key={task.id}
              to="/tasks"
              className="group flex items-center gap-2.5 rounded-lg border border-border/50 px-3 py-2 hover:bg-muted/40 transition-colors"
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
            </Link>
          )
        })}
      </div>
    </div>
  )
}
