import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ArrowLeft, Trash2, Check, Loader2, AlertCircle, Building2, Printer, Lock } from 'lucide-react'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

import { useHeader } from '@/components/misc/header-context'
import { useAuth } from '@/context/AuthContext'
import { usePermissions } from '@/api/usePermissions'
import { useClients } from '@/api/clients'
import {
  useAgencyNoteById,
  updateAgencyNote,
  deleteAgencyNote,
} from '@/api/agencyNotes'
import { useNoteShares } from '@/api/noteShares'
import {
  useNoteTags,
  createNoteTag,
  addTagToNote,
  removeTagFromNote,
} from '@/api/noteTags'
import { nextTagColor } from '@/lib/noteTags'
import { ClientAvatar } from '@/components/tasks/ClientAvatar'
import RichTextEditor from '@/components/notes/RichTextEditor'
import TagPill from '@/components/notes/TagPill'
import TagPicker from '@/components/notes/TagPicker'
import ManageTagsDialog from '@/components/notes/ManageTagsDialog'
import NoteVisibilityToggle from '@/components/notes/NoteVisibilityToggle'
import NoteCollaboratorAvatars from '@/components/notes/NoteCollaboratorAvatars'
import ShareNoteDialog from '@/components/notes/ShareNoteDialog'
import { parseNoteBody } from '@/components/notes/noteContent'
import { printNote } from '@/components/notes/printNote'

function SaveIndicator({ state }) {
  if (state === 'saving')
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Saving…
      </span>
    )
  if (state === 'saved')
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check className="size-3.5" /> Saved
      </span>
    )
  if (state === 'error')
    return (
      <span className="flex items-center gap-1.5 text-xs text-destructive">
        <AlertCircle className="size-3.5" /> Save failed
      </span>
    )
  return null
}

export default function NoteEditorPage() {
  const { noteId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { setHeader } = useHeader()
  const { user } = useAuth()
  const { isAdmin } = usePermissions()

  const { data: note, isLoading, error } = useAgencyNoteById(noteId)
  const { data: clientsData } = useClients()
  const { data: allTags } = useNoteTags()
  const { data: myShares = [] } = useNoteShares(noteId)

  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState('none')
  const [saveState, setSaveState] = useState('idle')
  const [initializedId, setInitializedId] = useState(null)
  const [manageTagsOpen, setManageTagsOpen] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)

  const editorRef = useRef(null)
  const valuesRef = useRef({ title: '', body: '', client_id: null })
  const dirtyRef = useRef(false)
  const saveTimer = useRef(null)
  const idleTimer = useRef(null)
  const mountedRef = useRef(true)

  const allClients = useMemo(() => {
    if (!clientsData) return []
    return [
      ...(clientsData.internalAccount ? [clientsData.internalAccount] : []),
      ...clientsData.realClients,
    ]
  }, [clientsData])

  const selectedClient = useMemo(
    () => allClients.find((c) => c.id === clientId) || null,
    [allClients, clientId],
  )

  const noteTags = useMemo(() => note?.tags ?? [], [note?.tags])
  const selectedTagIds = useMemo(() => noteTags.map((t) => t.id), [noteTags])

  // Tags live in a junction table, independent of the note's auto-save. They are
  // mutated directly and never touch dirtyRef — so tagging a note then hitting
  // Back must NOT bump updated_at or reorder the list.
  const invalidateNoteTags = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['agency-notes', 'detail', noteId] })
    queryClient.invalidateQueries({ queryKey: ['agency-notes', 'list'] })
  }, [queryClient, noteId])

  const toggleTagMutation = useMutation({
    mutationFn: async (tagId) => {
      if (selectedTagIds.includes(tagId)) await removeTagFromNote(noteId, tagId)
      else await addTagToNote(noteId, tagId)
    },
    onSuccess: invalidateNoteTags,
    onError: (err) => toast.error(err.message || 'Failed to update tags'),
  })

  const createTagMutation = useMutation({
    mutationFn: (name) =>
      createNoteTag({ name, color: nextTagColor(allTags?.length ?? 0) }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['note-tags', 'list'] }),
    onError: (err) => toast.error(err.message || 'Failed to create tag'),
  })

  // Populate the controlled inputs when the note loads/changes (guarded set-during-render —
  // the documented React pattern for resetting state when an entity id changes).
  if (note && note.id !== initializedId) {
    setInitializedId(note.id)
    setTitle(note.title || '')
    setClientId(note.client_id || 'none')
  }

  // Seed the save buffer (ref, not state) whenever the loaded note changes.
  useEffect(() => {
    if (note) {
      valuesRef.current = {
        title: note.title || '',
        body: note.body || '',
        client_id: note.client_id || null,
      }
      dirtyRef.current = false
    }
  }, [note?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setHeader({
      title: note?.title || 'Untitled',
      breadcrumbs: [
        { label: 'Operations', href: '/operations' },
        { label: 'Notes', href: '/operations/notes' },
        { label: note?.title || 'Untitled' },
      ],
    })
  }, [setHeader, note?.title])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimeout(saveTimer.current)
      clearTimeout(idleTimer.current)
    }
  }, [])

  const scheduleSave = useCallback(
    (patch) => {
      valuesRef.current = { ...valuesRef.current, ...patch }
      dirtyRef.current = true
      setSaveState('saving')
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        try {
          await updateAgencyNote(noteId, valuesRef.current)
          if (!mountedRef.current) return
          dirtyRef.current = false
          setSaveState('saved')
          queryClient.invalidateQueries({ queryKey: ['agency-notes', 'list'] })
          queryClient.invalidateQueries({ queryKey: ['agency-notes', 'detail', noteId] })
          clearTimeout(idleTimer.current)
          idleTimer.current = setTimeout(() => {
            if (mountedRef.current) setSaveState('idle')
          }, 2000)
        } catch (err) {
          if (!mountedRef.current) return
          setSaveState('error')
          toast.error('Auto-save failed: ' + (err.message || 'Unknown error'))
        }
      }, 600)
    },
    [noteId, queryClient],
  )

  function handleTitleChange(e) {
    const v = e.target.value
    setTitle(v)
    scheduleSave({ title: v })
  }

  function handleClientChange(v) {
    setClientId(v)
    scheduleSave({ client_id: v === 'none' ? null : v })
  }

  function handleBodyChange(json) {
    scheduleSave({ body: json })
  }

  async function handleBack() {
    clearTimeout(saveTimer.current)
    if (!dirtyRef.current) {
      navigate('/operations/notes')
      return
    }
    try {
      await updateAgencyNote(noteId, valuesRef.current)
      dirtyRef.current = false
      queryClient.invalidateQueries({ queryKey: ['agency-notes', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['agency-notes', 'detail', noteId] })
    } catch {
      // best-effort flush; navigation proceeds regardless
    }
    navigate('/operations/notes')
  }

  async function handleVisibilityChange(newVisibility) {
    try {
      await updateAgencyNote(noteId, { visibility: newVisibility })
      queryClient.invalidateQueries({ queryKey: ['agency-notes', 'detail', noteId] })
      queryClient.invalidateQueries({ queryKey: ['agency-notes', 'list'] })
      toast.success(newVisibility === 'private' ? 'Note set to Private' : 'Note set to Workspace')
    } catch (err) {
      toast.error(err.message || 'Failed to update visibility')
    }
  }

  async function handleDelete() {
    try {
      await deleteAgencyNote(noteId)
      queryClient.invalidateQueries({ queryKey: ['agency-notes', 'list'] })
      toast.success('Note deleted')
      navigate('/operations/notes')
    } catch (err) {
      toast.error(err.message || 'Failed to delete note')
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !note) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <p className="text-destructive text-sm">
          {error?.message || 'Note not found'}
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/operations/notes')}>
          <ArrowLeft className="size-4 mr-2" /> Back to Notes
        </Button>
      </div>
    )
  }

  const isAuthor = note.created_by === user?.id
  const myPermission = myShares.find((s) => s.member_user_id === user?.id)?.permission
  const canEdit =
    isAuthor ||
    note.visibility === 'workspace' ||
    (note.visibility === 'shared' && myPermission === 'write')
  // Mirrors the notes_delete RLS policy exactly: author, or a workspace
  // admin/owner deleting a plain Workspace note. A shared invitee — even at
  // write permission — can never delete, and a regular member can't delete
  // someone else's Workspace note either.
  const canDelete = isAuthor || (note.visibility === 'workspace' && isAdmin)

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-4 animate-in fade-in duration-300">
      {/* Row 1: back · collaborator avatars, print, delete */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={handleBack}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        <div className="flex items-center gap-3">
          <SaveIndicator state={saveState} />
          <NoteCollaboratorAvatars
            noteId={noteId}
            authorId={note.created_by}
            authorName={note.created_by_name}
            visibility={note.visibility}
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            title="Print / Save as PDF"
            onClick={() =>
              printNote(
                title || 'Untitled',
                editorRef.current?.view?.dom?.innerHTML || editorRef.current?.getHTML() || '',
                selectedClient?.name || null,
              )
            }
          >
            <Printer className="size-4" />
          </Button>
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete note?</AlertDialogTitle>
                  <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDelete}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Row 2: title, tags */}
      <div className="flex items-center gap-2">
        {note.visibility === 'private' && (
          <Lock className="size-6 shrink-0 text-muted-foreground" />
        )}
        <Input
          value={title}
          onChange={handleTitleChange}
          readOnly={!canEdit}
          placeholder="Untitled"
          className="flex-1 min-w-0 bricolage border-0 shadow-none focus-visible:ring-0 px-0 h-auto text-3xl font-bold tracking-tight placeholder:text-muted-foreground/40 md:text-3xl"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {noteTags.map((tag) => (
          <TagPill
            key={tag.id}
            tag={tag}
            onRemove={canEdit ? () => toggleTagMutation.mutate(tag.id) : undefined}
          />
        ))}
        {canEdit && (
          <TagPicker
            selectedTagIds={selectedTagIds}
            allTags={allTags ?? []}
            onToggle={(tagId) => toggleTagMutation.mutate(tagId)}
            onCreate={(name) => createTagMutation.mutateAsync(name)}
            isBusy={createTagMutation.isPending}
            onManage={() => setManageTagsOpen(true)}
          />
        )}
      </div>

      {/* Row 3: created by · updated by */}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Created by{' '}
          <span className="font-medium text-foreground">{note.created_by_name || 'Unknown'}</span>
          {' · '}
          {format(new Date(note.created_at), 'd MMM yyyy, h:mm a')}
        </span>
        {note.updated_by && (
          <span>
            Updated by{' '}
            <span className="font-medium text-foreground">{note.updated_by_name || 'Unknown'}</span>
            {' · '}
            {format(new Date(note.updated_at), 'd MMM yyyy, h:mm a')}
          </span>
        )}
      </div>

      {/* Row 4: linked to client · visibility */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Linked to</span>
          <Select value={clientId} onValueChange={handleClientChange} disabled={!canEdit}>
            <SelectTrigger className="h-8 w-auto gap-2 border-0 shadow-none px-2 text-xs font-medium hover:bg-accent">
              <SelectValue>
                <span className="flex items-center gap-1.5">
                  {selectedClient ? (
                    <>
                      <ClientAvatar client={selectedClient} size="sm" />
                      {selectedClient.name}
                    </>
                  ) : (
                    <>
                      <Building2 className="size-4 text-muted-foreground" />
                      Agency-wide
                    </>
                  )}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span className="flex items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground" />
                  Agency-wide (no client)
                </span>
              </SelectItem>
              {allClients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    <ClientAvatar client={c} size="sm" />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <NoteVisibilityToggle
          visibility={note.visibility}
          onChange={handleVisibilityChange}
          onShareClick={() => setShareDialogOpen(true)}
          disabled={!isAuthor}
        />
      </div>

      {/* Body */}
      <RichTextEditor
        key={note.id}
        content={parseNoteBody(note.body)}
        onChange={handleBodyChange}
        editable={canEdit}
        editorRef={editorRef}
        noteId={noteId}
      />

      <ManageTagsDialog
        open={manageTagsOpen}
        onOpenChange={setManageTagsOpen}
        tags={allTags ?? []}
      />

      <ShareNoteDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        noteId={noteId}
      />
    </div>
  )
}
