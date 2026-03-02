/* eslint-disable react-hooks/set-state-in-effect */
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
import { createNote } from '@/api/notes'
import { useClients } from '@/api/clients'
import { toast } from 'sonner'
import { ClientAvatar } from './NoteRow'

/**
 * Props:
 *  - clientId    string | null  — Pre-selects a client on open.
 *  - lockClient  boolean        — When true, hides the selector and shows a
 *                                 read-only pill. Pass this from OverviewTab.
 *                                 Omit (or false) from the global page so the
 *                                 user can freely choose any client.
 *  - children                  — Trigger element.
 *  - open / onOpenChange       — Controlled open state (optional).
 *  - onSuccess   () => void    — Called after a successful save (optional).
 */
export default function CreateNoteDialog({
  clientId,
  lockClient = false,
  children,
  open,
  onOpenChange,
  onSuccess,
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = open !== undefined && onOpenChange !== undefined
  const isOpen = isControlled ? open : internalOpen
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen

  const queryClient = useQueryClient()

  const { data: clientsData, isLoading: isLoadingClients } = useClients()

  const defaultSelectId = clientId || (clientsData?.internalAccount?.id ?? '')

  const [selectedClientId, setSelectedClientId] = useState(defaultSelectId)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [dueAt, setDueAt] = useState('')

  // Re-apply the default whenever the dialog opens or dependencies change
  useEffect(() => {
    if (isOpen) {
      setSelectedClientId(clientId || (clientsData?.internalAccount?.id ?? ''))
    }
  }, [isOpen, clientId, clientsData?.internalAccount?.id])

  const allClients = useMemo(() => {
    if (!clientsData) return []
    return [
      ...(clientsData.internalAccount ? [clientsData.internalAccount] : []),
      ...clientsData.realClients,
    ]
  }, [clientsData])

  const selectedClient = allClients.find((c) => c.id === selectedClientId)

  const mutation = useMutation({
    mutationFn: (newNote) => createNote(newNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-notes'] })
      queryClient.invalidateQueries({
        queryKey: ['client-notes', selectedClientId],
      })
      toast.success('Note added successfully')
      resetForm()
      setIsOpen(false)
      onSuccess?.()
    },
    onError: (err) => toast.error('Failed to add note: ' + err.message),
  })

  const resetForm = () => {
    setTitle('')
    setContent('')
    setDueAt('')
    if (!lockClient)
      setSelectedClientId(clientId || (clientsData?.internalAccount?.id ?? ''))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    // Fallback to internal account if nothing is selected. If none exists, pass null.
    const finalClientId =
      selectedClientId || clientsData?.internalAccount?.id || null

    mutation.mutate({
      client_id: finalClientId,
      title,
      content: content || null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      status: 'TODO',
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader className="pb-2">
          <DialogTitle>Add Note or Reminder</DialogTitle>
          <DialogDescription>
            Create a private note or set a due date for a reminder.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5 py-4">
          {/* ── Client ── */}
          <div className="space-y-2">
            <Label>Client</Label>

            {lockClient && selectedClient ? (
              // Read-only pill — used when opened from a specific client's OverviewTab
              <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/40 text-sm">
                <ClientAvatar client={selectedClient} />
                <span className="font-medium text-foreground">
                  {selectedClient.name}
                </span>
                {selectedClient.is_internal && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0">
                    Internal
                  </Badge>
                )}
              </div>
            ) : (
              // Free selector — used from the global Notes & Reminders page
              <Select
                value={selectedClientId}
                onValueChange={setSelectedClientId}
                disabled={isLoadingClients}
              >
                <SelectTrigger className="h-9 text-sm w-full">
                  <SelectValue placeholder="Internal (Default)" />
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
            )}
          </div>

          {/* ── Title ── */}
          <div className="space-y-2">
            <Label htmlFor="note-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="note-title"
              placeholder="e.g., Follow up on signed agreement"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* ── Details ── */}
          <div className="space-y-2">
            <Label htmlFor="note-content">Details (Optional)</Label>
            <Textarea
              id="note-content"
              placeholder="Any extra context or links..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>

          {/* ── Due date ── */}
          <div className="space-y-2">
            <Label htmlFor="note-due">Due Date & Time (Optional)</Label>
            <Input
              id="note-due"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm()
                setIsOpen(false)
              }}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !title.trim()}
            >
              {mutation.isPending ? 'Saving...' : 'Save Note'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
