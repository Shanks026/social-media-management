import { useState, useMemo, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'

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
  updateAgencyNote,
  deleteAgencyNote,
} from '@/api/agencyNotes'
import AgencyNoteCard from '@/components/notes/AgencyNoteCard'
import AgencyNoteDialog from '@/components/notes/AgencyNoteDialog'

export default function Notes() {
  const { setHeader } = useHeader()
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingNote, setEditingNote] = useState(null)
  const [clientFilter, setClientFilter] = useState('all')
  const [search, setSearch] = useState('')

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

    return result
  }, [notes, clientFilter, search])

  const createMutation = useMutation({
    mutationFn: createAgencyNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency-notes', 'list'] })
      toast.success('Note saved')
      setDialogOpen(false)
    },
    onError: (err) => toast.error(err.message || 'Failed to save note'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => updateAgencyNote(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency-notes', 'list'] })
      toast.success('Note updated')
      setDialogOpen(false)
      setEditingNote(null)
    },
    onError: (err) => toast.error(err.message || 'Failed to update note'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAgencyNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency-notes', 'list'] })
      toast.success('Note deleted')
    },
    onError: (err) => toast.error(err.message || 'Failed to delete note'),
  })

  function handleEdit(note) {
    setEditingNote(note)
    setDialogOpen(true)
  }

  function handleDelete(noteId) {
    deleteMutation.mutate(noteId)
  }

  function handleDialogSubmit(values) {
    if (editingNote) {
      updateMutation.mutate({ id: editingNote.id, updates: values })
    } else {
      createMutation.mutate(values)
    }
  }

  function handleDialogOpenChange(open) {
    setDialogOpen(open)
    if (!open) setEditingNote(null)
  }

  function openCreateDialog() {
    setEditingNote(null)
    setDialogOpen(true)
  }

  const isLoading = isLoadingNotes || isLoadingClients
  const isSubmitting = createMutation.isPending || updateMutation.isPending

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

        <Button className="gap-2 h-9" onClick={openCreateDialog}>
          <Plus size={16} />
          New Note
        </Button>
      </div>

      {/* ── Controls Row ─────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:max-w-sm group shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search notes..."
            className="pl-9 h-9 bg-background border-border/60 shadow-none focus-visible:ring-1 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[180px] h-9 text-xs font-semibold shadow-none bg-background">
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
              {clientFilter === 'all' && !search ? 'No notes yet' : 'No notes match'}
            </EmptyTitle>
            <EmptyDescription>
              {clientFilter === 'all' && !search
                ? 'Create your first note to capture ideas, SOPs, or client context.'
                : 'Try adjusting your search or filter.'}
            </EmptyDescription>
          </EmptyHeader>
          {clientFilter === 'all' && !search && (
            <EmptyContent>
              <Button onClick={openCreateDialog}>
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
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <AgencyNoteDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        note={editingNote}
        clients={allClients}
        onSubmit={handleDialogSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
