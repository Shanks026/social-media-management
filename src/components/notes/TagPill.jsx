import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTagColor } from '@/lib/noteTags'

// A colored tag label. Pass `onRemove` to show a trailing X (used in the editor).
// `size`: 'sm' (default) or 'xs' (compact, for cards).
export default function TagPill({ tag, onRemove, size = 'sm', className }) {
  const color = getTagColor(tag.color)
  const isXs = size === 'xs'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium leading-none',
        isXs ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
        color.pill,
        className,
      )}
    >
      <span className={cn('rounded-full', color.dot, isXs ? 'size-1.5' : 'size-2')} />
      <span className="truncate max-w-[120px]">{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 rounded-full opacity-70 hover:opacity-100 transition-opacity"
          title="Remove tag"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}
