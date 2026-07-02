/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Megaphone, ChevronDown } from 'lucide-react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { createTask } from '@/api/tasks'
import { useClients } from '@/api/clients'
import { fetchActiveCampaignsByClient } from '@/api/campaigns'
import { useTeamMembers } from '@/api/team'
import { usePermissions } from '@/api/usePermissions'
import { useAuth } from '@/context/AuthContext'
import { DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { SYSTEM_ROLE_PALETTE } from '@/lib/team-roles'
import { ClientAvatar } from '@/components/tasks/ClientAvatar'

const NONE = '__none__'

const PRIORITY_CONFIG = [
  {
    value: 'LOW',
    label: 'Low',
    dot: 'bg-emerald-400',
    active:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  {
    value: 'NORMAL',
    label: 'Normal',
    dot: 'bg-zinc-400',
    active: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  },
  {
    value: 'HIGH',
    label: 'High',
    dot: 'bg-amber-400',
    active:
      'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  {
    value: 'URGENT',
    label: 'Urgent',
    dot: 'bg-red-500',
    active: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
]

function MetaRow({ label, children }) {
  return (
    <div className="flex items-center gap-3 min-h-8">
      <span className="text-xs text-muted-foreground w-20 shrink-0">
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

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
export default function CreateTaskDialog({
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
  const descRef = useRef(null)

  const { data: clientsData, isLoading: isLoadingClients } = useClients()

  const defaultSelectId = clientId || (clientsData?.internalAccount?.id ?? '')

  const [selectedClientId, setSelectedClientId] = useState(defaultSelectId)
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [priority, setPriority] = useState('NORMAL')

  const { canAssignTasks } = usePermissions()
  const { user } = useAuth()
  const { data: teamMembers = [] } = useTeamMembers()
  const assigneeOptions = useMemo(
    () =>
      teamMembers.filter(
        (m) => m.system_role !== 'owner' && m.system_role !== 'superadmin',
      ),
    [teamMembers],
  )

  useEffect(() => {
    if (isOpen) {
      setSelectedClientId(clientId || (clientsData?.internalAccount?.id ?? ''))
      setSelectedCampaignId('')
      setAssignedTo('')
      setPriority('NORMAL')
      setTitle('')
      setDescription('')
      setDueAt('')
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
  const selectedAssignee = assigneeOptions.find(
    (m) => m.member_user_id === assignedTo,
  )

  const { data: availableCampaigns = [], isLoading: loadingCampaigns } =
    useQuery({
      queryKey: ['campaigns', 'active-by-client', selectedClientId],
      queryFn: () => fetchActiveCampaignsByClient(selectedClientId),
      enabled: !!selectedClientId && !campaignId,
    })

  const selectedCampaign = availableCampaigns.find(
    (c) => c.id === selectedCampaignId,
  )

  const effectiveCampaignId =
    campaignId ||
    (selectedCampaignId && selectedCampaignId !== NONE
      ? selectedCampaignId
      : null)

  const mutation = useMutation({
    mutationFn: (newTask) => createTask(newTask),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tasks', 'list'],
        exact: false,
      })
      toast.success('Task added successfully')
      setIsOpen(false)
      onSuccess?.()
    },
    onError: (err) => toast.error('Failed to add task: ' + err.message),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!title.trim()) return

    const finalClientId =
      selectedClientId || clientsData?.internalAccount?.id || null

    mutation.mutate({
      client_id: finalClientId,
      title: title.trim(),
      description: description.trim() || null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      priority,
      status: 'TODO',
      assigned_to: assignedTo || null,
      ...(effectiveCampaignId ? { campaign_id: effectiveCampaignId } : {}),
    })
  }

  const autoResizeDesc = (e) => {
    e.target.style.height = 'auto'
    e.target.style.height = e.target.scrollHeight + 'px'
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 space-y-0.5">
          <DialogTitle>Add Task</DialogTitle>
          <DialogDescription>
            Track work, set deadlines, and stay on top of what needs to get
            done.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {/* ── Writing area ── */}
          <div className="px-6 pt-6 pb-6">
            <input
              autoFocus
              placeholder="Enter task title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xl font-semibold bg-transparent border-none outline-none placeholder:text-muted-foreground/30 mb-3 text-foreground"
            />
            <textarea
              ref={descRef}
              placeholder="Add a description..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                autoResizeDesc(e)
              }}
              className="w-full text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/40 resize-none leading-relaxed text-muted-foreground focus:text-foreground transition-colors"
              rows={2}
            />
          </div>

          {/* ── Metadata rows ── */}
          <div className="border-t border-border/50 px-6 py-5 space-y-2">
            {/* Client */}
            <MetaRow label="Client">
              {lockClient && selectedClient ? (
                <div className="flex items-center gap-2 text-sm">
                  <ClientAvatar client={selectedClient} size="sm" />
                  <span className="font-medium">{selectedClient.name}</span>
                </div>
              ) : (
                <Select
                  value={selectedClientId}
                  onValueChange={(val) => {
                    setSelectedClientId(val)
                    setSelectedCampaignId('')
                  }}
                  disabled={isLoadingClients}
                >
                  <SelectTrigger className="h-7 border-0 shadow-none bg-transparent hover:bg-muted/60 focus:ring-0 px-2 text-sm w-auto max-w-full">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
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
              )}
            </MetaRow>

            {/* Assignee */}
            {canAssignTasks && (
              <MetaRow label="Assignee">
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger className="h-7 border-0 shadow-none bg-transparent hover:bg-muted/60 focus:ring-0 px-2 text-sm w-auto max-w-full">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>
                      <span className="text-muted-foreground">Unassigned</span>
                    </SelectItem>
                    {assigneeOptions.map((m) => {
                      const rolePalette =
                        SYSTEM_ROLE_PALETTE[m.system_role] ??
                        SYSTEM_ROLE_PALETTE.member
                      return (
                        <SelectItem
                          key={m.member_user_id}
                          value={m.member_user_id}
                        >
                          <div className="flex items-center gap-2 w-full min-w-0 pr-1">
                            {m.avatar_url ? (
                              <img
                                src={m.avatar_url}
                                alt=""
                                className="size-5 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-semibold text-primary shrink-0">
                                {(m.full_name ||
                                  m.email ||
                                  '?')[0].toUpperCase()}
                              </div>
                            )}
                            <span className="flex-1 truncate">
                              {m.full_name || m.email}
                              {m.member_user_id === user?.id && (
                                <span className="text-muted-foreground ml-1">(You)</span>
                              )}
                            </span>
                            <Badge
                              className={cn(
                                'text-[9px] px-1.5 py-0 ml-2 shrink-0',
                                rolePalette.badge,
                              )}
                            >
                              {rolePalette.label}
                            </Badge>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </MetaRow>
            )}

            {/* Priority */}
            <MetaRow label="Priority">
              <div className="flex items-center gap-1">
                {PRIORITY_CONFIG.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                      priority === p.value
                        ? p.active
                        : 'text-muted-foreground hover:bg-muted/60',
                    )}
                  >
                    <span
                      className={cn('size-1.5 rounded-full shrink-0', p.dot)}
                    />
                    {p.label}
                  </button>
                ))}
              </div>
            </MetaRow>

            {/* Due date */}
            <MetaRow label="Due date">
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="h-7 text-sm bg-transparent border-0 outline-none text-muted-foreground hover:text-foreground transition-colors px-2 rounded-md hover:bg-muted/60 cursor-pointer"
              />
            </MetaRow>

            {/* Campaign */}
            {!campaignId ? (
              <MetaRow label="Campaign">
                <Select
                  value={selectedCampaignId}
                  onValueChange={setSelectedCampaignId}
                  disabled={!selectedClientId || loadingCampaigns}
                >
                  <SelectTrigger className="h-7 border-0 shadow-none bg-transparent hover:bg-muted/60 focus:ring-0 px-2 text-sm w-auto max-w-full">
                    <SelectValue placeholder="None" />
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
              </MetaRow>
            ) : (
              <MetaRow label="Campaign">
                <div className="flex items-center gap-1.5 px-2 text-sm text-foreground">
                  <Megaphone className="size-3 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">
                    {campaignName ?? 'Campaign'}
                  </span>
                </div>
              </MetaRow>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="border-t border-border/50 px-6 py-4 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={mutation.isPending || !title.trim()}
            >
              {mutation.isPending ? 'Saving...' : 'Save Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
