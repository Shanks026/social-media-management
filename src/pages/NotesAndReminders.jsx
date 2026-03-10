import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  FileText,
  Plus,
  Filter,
  Building2,
  Bell,
  Circle,
  CheckCircle2,
  Archive,
  RotateCcw,
  Pencil,
  Trash2,
  Search,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

import { useHeader } from '@/components/misc/header-context'
import { useClients } from '@/api/clients'
import { fetchAllNotes, updateNoteStatus, deleteNote } from '@/api/notes'
import CreateNoteDialog from '@/components/CreateNoteDialog'
import EditNoteDialog from '@/components/EditNoteDialog'
import { ClientAvatar } from '@/components/NoteRow'
import { cn } from '@/lib/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'TODO', label: 'To Do' },
  { key: 'DONE', label: 'Done' },
  { key: 'ARCHIVED', label: 'Archived' },
]

const STATUS_CONFIG = {
  TODO: {
    label: 'To Do',
    className:
      'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-transparent',
  },
  DONE: {
    label: 'Done',
    className:
      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-transparent',
  },
  ARCHIVED: {
    label: 'Archived',
    className: 'bg-muted text-muted-foreground border-transparent',
  },
}

// ─── Note Card ────────────────────────────────────────────────────────────────

function NoteCard({ note, clientMap }) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['global-notes'] })
    queryClient.invalidateQueries({
      queryKey: ['client-notes', note.client_id],
    })
  }

  const { mutate: setStatus, isPending: isSettingStatus } = useMutation({
    mutationFn: (newStatus) => updateNoteStatus(note.id, newStatus),
    onSuccess: invalidate,
    onError: (err) => toast.error('Failed to update note: ' + err.message),
  })

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteNote(note.id),
    onSuccess: () => {
      invalidate()
      toast.success('Note deleted')
    },
    onError: (err) => toast.error('Failed to delete note: ' + err.message),
  })

  const isBusy = isSettingStatus || isDeleting
  const overdue =
    note.due_at &&
    // eslint-disable-next-line react-hooks/purity
    new Date(note.due_at).getTime() < Date.now() &&
    note.status === 'TODO'
  const client = clientMap[String(note.client_id)]
  const statusCfg = STATUS_CONFIG[note.status] ?? STATUS_CONFIG.TODO

  const handleCircleClick = () => {
    if (note.status === 'TODO') setStatus('DONE')
    else if (note.status === 'DONE') setStatus('TODO')
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <>
      <div
        className={cn(
          'group flex flex-col bg-card/50 rounded-xl shadow-sm ring-1 ring-border/50 overflow-hidden transition-all hover:shadow-md',
          note.status === 'ARCHIVED' && 'opacity-60',
        )}
      >
        <div className="px-5 pt-5 pb-4 flex flex-col flex-1">
          {/* Title Row */}
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <div className="flex items-start gap-3 min-w-0">
              {note.status !== 'ARCHIVED' ? (
                <button
                  onClick={handleCircleClick}
                  disabled={isBusy}
                  className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                >
                  {note.status === 'TODO' ? (
                    <Circle className="size-5 stroke-[2.5]" />
                  ) : (
                    <CheckCircle2 className="size-5 text-emerald-500 stroke-[2.5]" />
                  )}
                </button>
              ) : (
                <div className="size-5 mt-0.5 shrink-0" />
              )}
              <div className="flex flex-col gap-1 min-w-0">
                <p
                  className={cn(
                    'text-sm font-semibold leading-snug',
                    note.status === 'DONE' &&
                      'line-through text-muted-foreground',
                  )}
                >
                  {note.title}
                </p>
                {note.content && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {note.content}
                  </p>
                )}
              </div>
            </div>

            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-2 py-0.5 shrink-0 font-medium',
                statusCfg.className,
              )}
            >
              {statusCfg.label}
            </Badge>
          </div>

          <div className="mt-auto pt-4">
            <div className="border-t border-dashed border-border/60 mb-4" />

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
                  <Building2 className="size-3" />
                  <span>No client linked</span>
                </div>
              )}

              <div
                className={cn(
                  'flex items-center gap-1.5 text-[11px] font-medium shrink-0',
                  overdue ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                <Bell className="size-3.5" />
                {note.due_at
                  ? format(new Date(note.due_at), 'MMM d, h:mm a')
                  : '-'}
              </div>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center gap-1 px-4 py-2.5 border-t border-border/40 bg-muted/20">
          {note.status === 'ARCHIVED' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-primary gap-1.5"
              onClick={() => setStatus('TODO')}
              disabled={isBusy}
            >
              <RotateCcw className="size-3.5" /> Restore
            </Button>
          )}

          <div className="flex-1" />

          {note.status !== 'ARCHIVED' && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-amber-500"
              onClick={() => setStatus('ARCHIVED')}
              disabled={isBusy}
              title="Archive"
            >
              <Archive className="size-3.5" />
            </Button>
          )}
          {note.status !== 'ARCHIVED' && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-primary"
              onClick={() => setEditOpen(true)}
              disabled={isBusy}
              title="Edit"
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
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

      <EditNoteDialog note={note} open={editOpen} onOpenChange={setEditOpen} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>
              "{note.title}" will be permanently deleted. This cannot be undone.
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

// ─── Notes Grid Group ─────────────────────────────────────────────────────────

function NotesGroup({ title, notes, clientMap }) {
  if (notes.length === 0) return null
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
        {notes.map((note) => (
          <NoteCard key={note.id} note={note} clientMap={clientMap} />
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NotesAndReminders() {
  const { setHeader } = useHeader()
  const queryClient = useQueryClient()

  const [statusTab, setStatusTab] = useState('ALL')
  const [selectedClient, setSelectedClient] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setHeader({
      title: 'Notes & Reminders',
      breadcrumbs: [
        { label: 'Operations', href: '/operations' },
        { label: 'Notes & Reminders', href: '/operations/notes' },
      ],
    })
  }, [setHeader])

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: clientsData, isLoading: isLoadingClients } = useClients()

  const allClients = useMemo(() => {
    if (!clientsData) return []
    return [
      ...(clientsData.internalAccount ? [clientsData.internalAccount] : []),
      ...clientsData.realClients,
    ]
  }, [clientsData])

  const clientMap = useMemo(() => {
    const map = Object.fromEntries(allClients.map((c) => [c.id, c]))
    // Specifically handle null client_id to map to internal account
    map['null'] = clientsData?.internalAccount
      ? {
          ...clientsData.internalAccount,
          name: clientsData.internalAccount.name || 'Internal',
        }
      : { id: null, name: 'Internal', is_internal: true }
    return map
  }, [allClients, clientsData])

  const defaultClientId = clientsData?.internalAccount?.id ?? null

  const { data: fetchedNotes = [], isLoading: isLoadingNotes } = useQuery({
    queryKey: ['global-notes'],
    queryFn: fetchAllNotes,
  })

  const allNotes = useMemo(() => {
    if (selectedClient === 'all') return fetchedNotes
    // if a note is explicitly assigned to null, and the internal client is selected:
    if (selectedClient === defaultClientId) {
      return fetchedNotes.filter(
        (n) => n.client_id === selectedClient || n.client_id === null,
      )
    }
    return fetchedNotes.filter((n) => n.client_id === selectedClient)
  }, [fetchedNotes, selectedClient, defaultClientId])

  // ── Filtering & Grouping ──────────────────────────────────────────────────

  const filteredNotes = useMemo(() => {
    return allNotes.filter((note) => {
      if (statusTab !== 'ALL' && note.status !== statusTab) return false

      if (search.trim()) {
        const query = search.toLowerCase()
        const matchesTitle = note.title?.toLowerCase().includes(query)
        const matchesContent = note.content?.toLowerCase().includes(query)
        if (!matchesTitle && !matchesContent) return false
      }

      return true
    })
  }, [allNotes, statusTab, search])

  // Fix: each status goes into its own bucket — ARCHIVED never touches nonTodoNotes
  const { overdueNotes, upcomingNotes, doneNotes, archivedNotes } =
    useMemo(() => {
      // eslint-disable-next-line react-hooks/purity
      const now = Date.now()
      const overdue = [],
        upcoming = [],
        done = [],
        archived = []

      filteredNotes.forEach((note) => {
        if (note.status === 'ARCHIVED') {
          archived.push(note)
        } else if (note.status === 'DONE') {
          done.push(note)
        } else {
          // TODO
          note.due_at && new Date(note.due_at).getTime() < now
            ? overdue.push(note)
            : upcoming.push(note)
        }
      })

      return {
        overdueNotes: overdue,
        upcomingNotes: upcoming,
        doneNotes: done,
        archivedNotes: archived,
      }
    }, [filteredNotes])

  const counts = useMemo(
    () =>
      STATUS_TABS.reduce((acc, tab) => {
        acc[tab.key] =
          tab.key === 'ALL'
            ? allNotes.length
            : allNotes.filter((n) => n.status === tab.key).length
        return acc
      }, {}),
    [allNotes],
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      {/* ── Header ─────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-normal tracking-tight text-foreground">
            Notes & Reminders{' '}
            {filteredNotes.length > 0 && (
              <span className="text-muted-foreground/50 ml-2 font-extralight">
                {filteredNotes.length}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            All notes and reminders across your organization
          </p>
        </div>

        <CreateNoteDialog
          clientId={defaultClientId}
          onSuccess={() =>
            queryClient.invalidateQueries({ queryKey: ['global-notes'] })
          }
        >
          <Button className="gap-2 h-9">
            <Plus size={16} />
            New Note
          </Button>
        </CreateNoteDialog>
      </div>

      {/* ── Controls Row ─────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Search */}
        <div className="relative w-full sm:max-w-sm group shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search notes..."
            className="pl-9 h-9 bg-background border-border/60 shadow-none focus-visible:ring-1 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto sm:justify-end">
          <div className="flex items-center gap-1 rounded-md border p-0.5 bg-background shadow-sm">
            {STATUS_TABS.map((tab) => {
              const isActive = statusTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setStatusTab(tab.key)}
                  className={cn(
                    'h-8 px-3 py-1 inline-flex items-center gap-2 rounded-sm text-xs font-medium transition-all shrink-0',
                    isActive
                      ? 'bg-muted shadow-inner text-foreground'
                      : 'text-muted-foreground hover:bg-muted/40',
                  )}
                >
                  <span>{tab.label}</span>
                  {counts[tab.key] > 0 && (
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-full font-bold transition-colors min-w-5 text-center',
                        isActive
                          ? 'bg-background shadow-sm text-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {counts[tab.key]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-[180px] h-9 text-xs font-semibold shadow-none bg-background">
              <div className="flex items-center gap-2">
                <Filter size={14} className="shrink-0 opacity-50" />
                <SelectValue placeholder="Client" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {allClients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex items-center gap-2">
                    <ClientAvatar client={c} size="sm" />
                    <span className="truncate">{c.name}</span>
                    {c.is_internal && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1 py-0 ml-1"
                      >
                        INT
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notes grid */}
      {isLoadingNotes || isLoadingClients ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl border bg-card shadow-sm overflow-hidden"
            >
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="size-4 rounded-full shrink-0" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <div className="flex items-center justify-between px-3 py-2 border-t border-border/40 bg-muted/20">
                <Skeleton className="h-6 w-20" />
                <div className="flex gap-1">
                  <Skeleton className="size-7 rounded-md" />
                  <Skeleton className="size-7 rounded-md" />
                  <Skeleton className="size-7 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <div className="size-14 rounded-2xl border border-dashed flex items-center justify-center text-muted-foreground">
            <FileText className="size-6 opacity-40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            No notes found
          </p>
          <p className="text-xs text-muted-foreground/70 max-w-xs">
            Create a new note or adjust your filters.
          </p>
        </div>
      ) : (
        <div className="space-y-8 pt-1">
          {(statusTab === 'ALL' || statusTab === 'TODO') &&
            overdueNotes.length > 0 && (
              <NotesGroup
                title={`Overdue · ${overdueNotes.length}`}
                notes={overdueNotes}
                clientMap={clientMap}
              />
            )}
          {(statusTab === 'ALL' || statusTab === 'TODO') &&
            upcomingNotes.length > 0 && (
              <NotesGroup
                title={
                  statusTab === 'TODO'
                    ? `To Do · ${upcomingNotes.length}`
                    : `Upcoming · ${upcomingNotes.length}`
                }
                notes={upcomingNotes}
                clientMap={clientMap}
              />
            )}
          {(statusTab === 'ALL' || statusTab === 'DONE') &&
            doneNotes.length > 0 && (
              <NotesGroup
                title={`Done · ${doneNotes.length}`}
                notes={doneNotes}
                clientMap={clientMap}
              />
            )}
          {(statusTab === 'ALL' || statusTab === 'ARCHIVED') &&
            archivedNotes.length > 0 && (
              <NotesGroup
                title={`Archived · ${archivedNotes.length}`}
                notes={archivedNotes}
                clientMap={clientMap}
              />
            )}
        </div>
      )}
    </div>
  )
}
