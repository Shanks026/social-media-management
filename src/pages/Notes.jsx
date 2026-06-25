import { useState, useMemo, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, ChevronDown, Settings2 } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from '@/components/ui/empty'

import { useHeader } from '@/components/misc/header-context'
import { useClients } from '@/api/clients'
import {
  useAgencyNotes,
  createAgencyNote,
  deleteAgencyNote,
} from '@/api/agencyNotes'
import { useNoteTags } from '@/api/noteTags'
import { getTagColor } from '@/lib/noteTags'
import AgencyNoteCard from '@/components/notes/AgencyNoteCard'
import ManageTagsDialog from '@/components/notes/ManageTagsDialog'

export default function Notes() {
  const { setHeader } = useHeader()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [clientFilter, setClientFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState([])
  const [manageOpen, setManageOpen] = useState(false)

  useEffect(() => {
    setHeader({
      title: 'Notes',
      breadcrumbs: [
        { label: 'Operations', href: '/operations' },
        { label: 'Notes', href: '/operations/notes' },
      ],
    })
  }, [setHeader])

  const { data: clientsData, isLoading: isLoadingClients } = useClients()
  const { data: notes, isLoading: isLoadingNotes, error } = useAgencyNotes()
  const { data: allTags } = useNoteTags()

  // Note count per tag, computed from the full (unfiltered) list — drives the
  // "N notes" labels and the delete confirmation in Manage tags.
  const noteCounts = useMemo(() => {
    const counts = {}
    for (const n of notes ?? []) {
      for (const t of n.tags ?? []) counts[t.id] = (counts[t.id] ?? 0) + 1
    }
    return counts
  }, [notes])

  function toggleTagFilter(tagId) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    )
  }

  // Drop any selected tag ids that no longer exist (e.g. deleted in Manage tags)
  // so the filter never wedges on a phantom tag. Guarded set-during-render —
  // the condition becomes false on the next pass.
  if (allTags && selectedTagIds.some((id) => !allTags.some((t) => t.id === id))) {
    setSelectedTagIds((prev) => prev.filter((id) => allTags.some((t) => t.id === id)))
  }

  const allClients = useMemo(() => {
    if (!clientsData) return []
    return [
      ...(clientsData.internalAccount ? [clientsData.internalAccount] : []),
      ...clientsData.realClients,
    ]
  }, [clientsData])

  const clientMap = useMemo(
    () => Object.fromEntries(allClients.map((c) => [c.id, c])),
    [allClients],
  )

  const filteredNotes = useMemo(() => {
    if (!notes) return []
    let result = notes

    if (clientFilter === 'none') result = result.filter((n) => !n.client_id)
    else if (clientFilter !== 'all') result = result.filter((n) => n.client_id === clientFilter)

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (n) =>
          n.title?.toLowerCase().includes(q) || n.body?.toLowerCase().includes(q),
      )
    }

    // Tag filter: a note matches if it carries ANY of the selected tags (OR),
    // composed AND-wise with the search and client filters above.
    if (selectedTagIds.length) {
      result = result.filter((n) => {
        const ids = (n.tags ?? []).map((t) => t.id)
        return selectedTagIds.some((id) => ids.includes(id))
      })
    }

    return result
  }, [notes, clientFilter, search, selectedTagIds])

  const createMutation = useMutation({
    mutationFn: createAgencyNote,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agency-notes', 'list'] })
      navigate(`/operations/notes/${data.id}`)
    },
    onError: (err) => toast.error(err.message || 'Failed to create note'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAgencyNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency-notes', 'list'] })
      toast.success('Note deleted')
    },
    onError: (err) => toast.error(err.message || 'Failed to delete note'),
  })

  function handleNewNote() {
    createMutation.mutate({ title: '', body: '' })
  }

  function handleOpen(note) {
    navigate(`/operations/notes/${note.id}`)
  }

  function handleDelete(noteId) {
    deleteMutation.mutate(noteId)
  }

  const isLoading = isLoadingNotes || isLoadingClients
  const noFilters = clientFilter === 'all' && !search && selectedTagIds.length === 0

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-500">
      {/* ── Header ─────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-normal tracking-tight text-foreground bricolage">
            Notes{' '}
            {filteredNotes.length > 0 && (
              <span className="text-muted-foreground/50 ml-2 font-extralight">
                {filteredNotes.length}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            Freeform notes for your agency — SOPs, briefs, client context
          </p>
        </div>

        <Button className="gap-2 h-9" onClick={handleNewNote} disabled={createMutation.isPending}>
          <Plus size={16} />
          New Note
        </Button>
      </div>

      {/* ── Controls Row ─────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="relative w-full sm:max-w-sm group shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search notes..."
            className="pl-9 h-9 bg-background border-border/60 shadow-none focus-visible:ring-1 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[160px] h-9 text-xs font-semibold shadow-none bg-background">
              <SelectValue placeholder="All notes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All notes</SelectItem>
              <SelectItem value="none">Agency-wide</SelectItem>
              {allClients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {allTags?.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-semibold">
                  Tags
                  {selectedTagIds.length > 0 && (
                    <span className="rounded-full bg-primary text-primary-foreground px-1.5 py-0.5 text-[10px] leading-none">
                      {selectedTagIds.length}
                    </span>
                  )}
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-52 p-1">
                {allTags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id)
                  const dot = getTagColor(tag.color).dot
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTagFilter(tag.id)}
                      className="flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      <Checkbox checked={selected} className="pointer-events-none" />
                      <span className={cn('size-2.5 shrink-0 rounded-full', dot)} />
                      <span className="truncate">{tag.name}</span>
                    </button>
                  )
                })}
                {selectedTagIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedTagIds([])}
                    className="mt-1 flex w-full items-center justify-center border-t pt-1.5 pb-0.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear selection
                  </button>
                )}
              </PopoverContent>
            </Popover>
          )}

          {allTags?.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs font-semibold"
              onClick={() => setManageOpen(true)}
            >
              <Settings2 className="size-3.5" />
              Manage tags
            </Button>
          )}
        </div>
      </div>

      {/* ── Body ─────────────────────────── */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">{error.message || 'Failed to load notes'}</p>
      ) : filteredNotes.length === 0 ? (
        <Empty>
          <EmptyMedia>
            <span className="text-5xl">📝</span>
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="font-bold text-xl">
              {noFilters ? 'No notes yet' : 'No notes match'}
            </EmptyTitle>
            <EmptyDescription>
              {noFilters
                ? 'Create your first note to capture ideas, SOPs, or client context.'
                : selectedTagIds.length > 0
                  ? 'No notes match these tags. Try adjusting your tags, search, or filter.'
                  : 'Try adjusting your search or filter.'}
            </EmptyDescription>
          </EmptyHeader>
          {noFilters && (
            <EmptyContent>
              <Button onClick={handleNewNote} disabled={createMutation.isPending}>
                <Plus className="size-4 mr-2" />
                New Note
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredNotes.map((note) => (
            <AgencyNoteCard
              key={note.id}
              note={note}
              clientMap={clientMap}
              onOpen={handleOpen}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <ManageTagsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        tags={allTags ?? []}
        noteCounts={noteCounts}
      />
    </div>
  )
}
