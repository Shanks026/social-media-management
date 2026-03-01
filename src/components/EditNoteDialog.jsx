import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Building2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateNote } from '@/api/notes'
import { useClients } from '@/api/clients'
import { toast } from 'sonner'

function ClientAvatar({ client }) {
  if (client?.logo_url) {
    return (
      <img
        src={client.logo_url}
        alt=""
        className="size-4 rounded object-cover ring-1 ring-border shrink-0"
      />
    )
  }
  return (
    <div className="size-4 rounded bg-muted flex items-center justify-center shrink-0">
      <Building2 className="size-2.5 text-muted-foreground" />
    </div>
  )
}

/**
 * Props:
 *  - note        object         — The note to edit.
 *  - open / onOpenChange       — Controlled open state.
 *  - onSuccess   () => void    — Called after a successful save (optional).
 */
export default function EditNoteDialog({
  note,
  open,
  onOpenChange,
  onSuccess,
}) {
  const queryClient = useQueryClient()
  const [selectedClientId, setSelectedClientId] = useState(note?.client_id ?? '')
  const [title, setTitle] = useState(note?.title ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [dueAt, setDueAt] = useState('')

  // Sync state when note changes or dialog opens
  useEffect(() => {
    if (open && note) {
      setSelectedClientId(note.client_id)
      setTitle(note.title)
      setContent(note.content ?? '')
      
      const dateStr = note.due_at 
        ? new Date(note.due_at).toISOString().slice(0, 16) 
        : ''
      setDueAt(dateStr)
    }
  }, [open, note])

  const { data: clientsData, isLoading: isLoadingClients } = useClients()

  const allClients = useMemo(() => {
    if (!clientsData) return []
    return [
      ...(clientsData.internalAccount ? [clientsData.internalAccount] : []),
      ...clientsData.realClients,
    ]
  }, [clientsData])

  const selectedClient = allClients.find((c) => c.id === selectedClientId)

  const mutation = useMutation({
    mutationFn: (updates) => updateNote(note.id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-notes'] })
      queryClient.invalidateQueries({
        queryKey: ['client-notes', selectedClientId],
      })
      toast.success('Note updated successfully')
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err) => toast.error('Failed to update note: ' + err.message),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!selectedClientId) {
      toast.error('Please select a client')
      return
    }
    mutation.mutate({
      client_id: selectedClientId,
      title,
      content: content || null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader className="pb-2">
          <DialogTitle>Edit Note or Reminder</DialogTitle>
          <DialogDescription>
            Update your private note or reminder details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5 py-4">
          {/* ── Client ── */}
          <div className="space-y-2">
            <Label>
              Client <span className="text-destructive">*</span>
            </Label>
            
            <Select
              value={selectedClientId}
              onValueChange={setSelectedClientId}
              disabled={isLoadingClients}
            >
              <SelectTrigger className="h-9 text-sm w-full">
                <SelectValue placeholder="Select a client…" />
              </SelectTrigger>
              <SelectContent>
                {allClients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <ClientAvatar client={c} />
                      <span className="truncate">{c.name}</span>
                      {c.is_internal && (
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1 py-0 ml-1"
                        >
                          Internal
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Title ── */}
          <div className="space-y-2">
            <Label htmlFor="edit-note-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-note-title"
              placeholder="e.g., Follow up on signed agreement"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* ── Details ── */}
          <div className="space-y-2">
            <Label htmlFor="edit-note-content">Details (Optional)</Label>
            <Textarea
              id="edit-note-content"
              placeholder="Any extra context or links..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>

          {/* ── Due date ── */}
          <div className="space-y-2">
            <Label htmlFor="edit-note-due">Due Date & Time (Optional)</Label>
            <Input
              id="edit-note-due"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                mutation.isPending || !title.trim() || !selectedClientId
              }
            >
              {mutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
