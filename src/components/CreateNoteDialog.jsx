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
import { Building2, Megaphone } from 'lucide-react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { createNote } from '@/api/notes'
import { useClients } from '@/api/clients'
import { fetchActiveCampaignsByClient } from '@/api/campaigns'
import { toast } from 'sonner'
import { ClientAvatar } from './NoteRow'

const NONE = '__none__'

/**
 * Props:
 *  - clientId      string | null  — Pre-selects a client on open.
 *  - lockClient    boolean        — When true, shows read-only client pill.
 *  - campaignId    string | null  — Locks the campaign (no selector shown).
 *  - campaignName  string | null  — Display name for the locked campaign pill.
 *  - children                    — Trigger element.
 *  - open / onOpenChange         — Controlled open state (optional).
 *  - onSuccess     () => void    — Called after a successful save (optional).
 */
export default function CreateNoteDialog({
  clientId,
  lockClient = false,
  campaignId = null,
  campaignName = null,
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
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [dueAt, setDueAt] = useState('')

  // Re-apply defaults whenever the dialog opens or dependencies change
  useEffect(() => {
    if (isOpen) {
      setSelectedClientId(clientId || (clientsData?.internalAccount?.id ?? ''))
      setSelectedCampaignId('')
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

  // Fetch active campaigns for selected client — only when campaign is not locked
  const { data: availableCampaigns = [], isLoading: loadingCampaigns } = useQuery({
    queryKey: ['campaigns', 'active-by-client', selectedClientId],
    queryFn: () => fetchActiveCampaignsByClient(selectedClientId),
    enabled: !!selectedClientId && !campaignId,
  })

  const effectiveCampaignId =
    campaignId ||
    (selectedCampaignId && selectedCampaignId !== NONE ? selectedCampaignId : null)

  const mutation = useMutation({
    mutationFn: (newNote) => createNote(newNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-notes'] })
      queryClient.invalidateQueries({ queryKey: ['client-notes', selectedClientId] })
      queryClient.invalidateQueries({ queryKey: ['notes', 'week-timeline'] })
      if (effectiveCampaignId) {
        queryClient.invalidateQueries({ queryKey: ['campaign-notes', effectiveCampaignId] })
      }
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
    setSelectedCampaignId('')
    if (!lockClient)
      setSelectedClientId(clientId || (clientsData?.internalAccount?.id ?? ''))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    const finalClientId =
      selectedClientId || clientsData?.internalAccount?.id || null

    mutation.mutate({
      client_id: finalClientId,
      title,
      content: content || null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      status: 'TODO',
      ...(effectiveCampaignId ? { campaign_id: effectiveCampaignId } : {}),
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
              <Select
                value={selectedClientId}
                onValueChange={(val) => {
                  setSelectedClientId(val)
                  setSelectedCampaignId('') // reset campaign when client changes
                }}
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

          {/* ── Campaign ── */}
          <div className="space-y-2">
            <Label>
              Campaign{' '}
              <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>

            {campaignId ? (
              // Locked — show read-only pill
              <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/40 text-sm">
                <Megaphone className="size-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium text-foreground truncate">
                  {campaignName ?? 'Campaign'}
                </span>
              </div>
            ) : (
              <Select
                value={selectedCampaignId}
                onValueChange={setSelectedCampaignId}
                disabled={!selectedClientId || loadingCampaigns}
              >
                <SelectTrigger className="h-9 text-sm w-full">
                  <SelectValue placeholder={
                    !selectedClientId
                      ? 'Select a client first'
                      : availableCampaigns.length === 0
                        ? 'No active campaigns'
                        : 'Select campaign'
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>
                    <span className="text-muted-foreground">None</span>
                  </SelectItem>
                  {availableCampaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <Megaphone className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{c.name}</span>
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
