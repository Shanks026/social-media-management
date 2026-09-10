import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getJobRoleColor } from '@/lib/job-roles'

/**
 * A colored job title label. Pass `onRemove` to show a trailing X.
 * `size`: 'sm' (default) or 'xs' (compact, for table cells and hover cards).
 *
 * Mirrors TagPill — same shape, pointed at job roles.
 */
export default function JobRolePill({ role, onRemove, size = 'sm', className }) {
  const color = getJobRoleColor(role.color)
  const isXs = size === 'xs'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium leading-none',
        isXs ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs',
        color.pill,
        className,
      )}
    >
      <span className={cn('rounded-full', color.dot, isXs ? 'size-1.5' : 'size-2')} />
      <span className="max-w-30 truncate">{role.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 rounded-full opacity-70 transition-opacity hover:opacity-100"
          title="Remove job role"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}
