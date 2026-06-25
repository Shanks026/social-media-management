import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Check } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
import { createNoteTag, updateNoteTag, deleteNoteTag } from '@/api/noteTags'
import { TAG_COLORS, TAG_COLOR_KEYS, getTagColor, nextTagColor } from '@/lib/noteTags'

function ColorPicker({ value, onPick }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Change color"
          className={cn(
            'size-5 shrink-0 rounded-full ring-1 ring-border transition-transform hover:scale-110',
            getTagColor(value).swatch,
          )}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="grid grid-cols-5 gap-1.5">
          {TAG_COLOR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              title={TAG_COLORS[key].label}
              onClick={() => {
                onPick(key)
                setOpen(false)
              }}
              className={cn(
                'flex size-6 items-center justify-center rounded-full transition-transform hover:scale-110',
                TAG_COLORS[key].swatch,
              )}
            >
              {value === key && <Check className="size-3.5 text-white" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function TagRow({ tag, count, onMutated }) {  // count is undefined when called without noteCounts
  const [name, setName] = useState(tag.name)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const updateMutation = useMutation({
    mutationFn: (updates) => updateNoteTag(tag.id, updates),
    onSuccess: onMutated,
    onError: (err) => {
      toast.error(err.message?.includes('duplicate') ? 'A tag with that name already exists' : err.message || 'Failed to update tag')
      setName(tag.name)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteNoteTag(tag.id),
    onSuccess: () => {
      toast.success('Tag deleted')
      onMutated()
    },
    onError: (err) => toast.error(err.message || 'Failed to delete tag'),
  })

  function commitName() {
    const trimmed = name.trim()
    if (!trimmed) {
      setName(tag.name)
      return
    }
    if (trimmed !== tag.name) updateMutation.mutate({ name: trimmed })
  }

  return (
    <div className="flex items-center gap-2 py-1.5">
      <ColorPicker value={tag.color} onPick={(color) => updateMutation.mutate({ color })} />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
        className="h-8 flex-1 text-sm"
      />
      {count !== undefined && (
        <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
          {count} {count === 1 ? 'note' : 'notes'}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => setConfirmOpen(true)}
        title="Delete tag"
      >
        <Trash2 className="size-4" />
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag “{tag.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {count > 0
                ? `It will be removed from ${count} ${count === 1 ? 'note' : 'notes'}. This can't be undone.`
                : "This tag isn't used by any note. This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function ManageTagsDialog({ open, onOpenChange, tags = [], noteCounts }) {
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(() => nextTagColor(0))

  const handleMutated = () => {
    queryClient.invalidateQueries({ queryKey: ['note-tags', 'list'] })
    queryClient.invalidateQueries({ queryKey: ['agency-notes', 'list'] })
  }

  const createMutation = useMutation({
    mutationFn: () => createNoteTag({ name: newName.trim(), color: newColor }),
    onSuccess: () => {
      handleMutated()
      setNewName('')
      setNewColor(nextTagColor(tags.length + 1))
    },
    onError: (err) =>
      toast.error(
        err.message?.includes('duplicate')
          ? 'A tag with that name already exists'
          : err.message || 'Failed to create tag',
      ),
  })

  function handleCreate() {
    if (!newName.trim()) return
    createMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage tags</DialogTitle>
          <DialogDescription>Create, rename, recolor, or delete your tags.</DialogDescription>
        </DialogHeader>

        {/* Existing tags */}
        {tags.length > 0 && (
          <div className="max-h-[50vh] divide-y overflow-y-auto">
            {tags.map((tag) => (
              <TagRow
                key={tag.id}
                tag={tag}
                count={noteCounts ? (noteCounts[tag.id] ?? 0) : undefined}
                onMutated={handleMutated}
              />
            ))}
          </div>
        )}

        {/* New tag row */}
        <div className="flex items-center gap-2 border-t pt-3">
          <ColorPicker value={newColor} onPick={setNewColor} />
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleCreate()
              }
            }}
            placeholder="New tag name…"
            className="h-8 flex-1 text-sm"
          />
          <Button
            size="sm"
            className="h-8 shrink-0"
            disabled={!newName.trim() || createMutation.isPending}
            onClick={handleCreate}
          >
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
