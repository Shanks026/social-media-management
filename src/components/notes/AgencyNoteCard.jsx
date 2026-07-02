import { useState } from 'react'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { ClientAvatar } from '@/components/TaskRow'
import { getNoteExcerpt } from '@/components/notes/noteContent'
import TagPill from '@/components/notes/TagPill'

export default function AgencyNoteCard({ note, clientMap, onOpen, onDelete }) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  const client = note.client_id ? clientMap[note.client_id] : null
  const excerpt = getNoteExcerpt(note.body)
  const tags = note.tags ?? []
  const visibleTags = tags.slice(0, 3)
  const overflowCount = tags.length - visibleTags.length

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(note)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onOpen(note)
        }}
        className="flex flex-col rounded-lg border bg-card p-5 hover:border-foreground/20 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* Title + menu */}
        <div className="flex items-start justify-between gap-2">
          <p className="bricolage font-medium text-base leading-tight line-clamp-2">
            {note.title || <span className="text-muted-foreground/50">Untitled</span>}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="size-7 shrink-0 -mt-0.5 -mr-1">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onOpen(note)}>
                <Pencil className="size-3.5 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Body */}
        <div className="flex-1 mt-3">
          {excerpt ? (
            <p className="text-sm text-muted-foreground line-clamp-3">{excerpt}</p>
          ) : (
            <p className="text-sm text-muted-foreground/50 italic">No content</p>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {visibleTags.map((tag) => (
              <TagPill key={tag.id} tag={tag} size="xs" />
            ))}
            {overflowCount > 0 && (
              <span className="text-[10px] font-medium text-muted-foreground">
                +{overflowCount}
              </span>
            )}
          </div>
        )}

        {/* Dashed separator */}
        <div className="border-t border-dashed border-border/60 mt-4 mb-3" />

        {/* Footer: client + date */}
        <div className="flex items-center justify-between">
          {client ? (
            <div className="flex items-center gap-2">
              <ClientAvatar client={client} size="sm" />
              <span className="text-xs font-medium text-foreground truncate max-w-[140px]">
                {client.name || 'Internal'}
              </span>
              {client.is_internal && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0">
                  INT
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Agency-wide</span>
          )}
          <span className="text-xs text-muted-foreground shrink-0">
            {format(new Date(note.updated_at), 'd MMM, yyyy · h:mm a')}
          </span>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onDelete(note.id)
                setDeleteOpen(false)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
