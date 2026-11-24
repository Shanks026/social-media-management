import { useState, useEffect, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Megaphone } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MemberAvatar } from '@/components/MemberAvatar'
import { ClientAvatar } from '@/components/tasks/ClientAvatar'
import { DeliverablePickerSection } from '@/components/tasks/DeliverablePickerSection'
import { TASK_PRIORITY_OPTIONS } from '@/components/tasks/taskPresentation'
import { useCreateTask, useUpdateTask, useTaskPostIds } from '@/api/tasks'
import { useClients } from '@/api/clients'
import { useActiveCampaignsByClient } from '@/api/campaigns'
import { useDeliverableOptions } from '@/api/posts'
import { useTeamMembers } from '@/api/team'
import { usePermissions } from '@/api/usePermissions'
import { useAuth } from '@/context/AuthContext'
import { fromDateTimeLocal, toDateTimeLocal } from '@/lib/format'
import { SYSTEM_ROLE_PALETTE } from '@/lib/team-roles'
import { cn } from '@/lib/utils'

// Radix Select cannot hold an empty value, so "nothing chosen" is this
// sentinel in the dropdown and '' in the form. It never reaches the database.
const NONE = '__none__'

const schema = z.object({
  title: z.string().trim().min(1, 'A task needs a title'),
  description: z.string(),
  clientId: z.string(),
  campaignId: z.string(),
  assignedTo: z.string(),
  priority: z.string(),
  dueAt: z.string(),
  postIds: z.array(z.string()),
})

const emptyValues = (clientId) => ({
  title: '',
  description: '',
  clientId: clientId || '',
  campaignId: '',
  assignedTo: '',
  priority: 'NORMAL',
  dueAt: '',
  postIds: [],
})

const triggerClass =
  'h-7 border-0 shadow-none bg-transparent hover:bg-muted/60 focus:ring-0 px-2 text-sm w-auto max-w-full'

function MetaRow({ label, children }) {
  return (
    <div className="flex items-center gap-3 min-h-8">
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

// Local wall-clock time, so an untouched due date saves back unchanged (B11).
const valuesFromTask = (task) => ({
  title: task.title ?? '',
  description: task.description ?? '',
  clientId: task.client_id || '',
  campaignId: task.campaign_id || '',
  assignedTo: task.assigned_to || '',
  priority: task.priority ?? 'NORMAL',
  dueAt: toDateTimeLocal(task.due_at),
  postIds: [],
})

/**
 * The one dialog for adding and editing a Task.
 *
 * Props:
 *  - task          object | null  — The Task to edit; without it the dialog adds one.
 *  - clientId      string | null  — Add only: pre-selects a client on open.
 *  - lockClient    boolean        — Add only: shows a read-only client pill.
 *  - campaignId    string | null  — Add only: locks the campaign (no selector shown).
 *  - campaignName  string | null  — Add only: display name for the locked campaign pill.
 *  - children                     — Trigger element.
 *  - open / onOpenChange          — Controlled open state (optional).
 *  - onSuccess     () => void     — Called after a successful save (optional).
 */
export default function TaskDialog({
  task = null,
  clientId,
  lockClient = false,
  campaignId = null,
  campaignName = null,
  children,
  open,
  onOpenChange,
  onSuccess,
}) {
  const isEdit = !!task
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = open !== undefined && onOpenChange !== undefined
  const isOpen = isControlled ? open : internalOpen
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(clientId),
  })
  const selectedClientId = form.watch('clientId')
  const postIds = form.watch('postIds')

  // Start from the Task (or empty) once per open. Keyed on the Task's id, not
  // the object, so a background refetch of the Task never wipes edits.
  const taskRef = useRef(task)
  useEffect(() => {
    taskRef.current = task
  })
  const taskId = task?.id
  useEffect(() => {
    if (!isOpen) return
    form.reset(taskRef.current ? valuesFromTask(taskRef.current) : emptyValues(clientId))
  }, [isOpen, clientId, taskId, form])

  // Linked Deliverables live in task_posts, not on the Task row. Seed them once
  // per open, after the reset above, so a refetch never clobbers the user's
  // choices either.
  const { data: linkedPostIds, isSuccess: linkedIdsLoaded } = useTaskPostIds(taskId, {
    enabled: isOpen,
  })
  const seededRef = useRef(false)
  useEffect(() => {
    if (!isOpen) {
      seededRef.current = false
      return
    }
    if (!seededRef.current && linkedIdsLoaded) {
      form.setValue('postIds', linkedPostIds)
      seededRef.current = true
    }
  }, [isOpen, linkedIdsLoaded, linkedPostIds, form])

  const { canAssignTasks } = usePermissions()
  const { user } = useAuth()
  const { data: teamMembers = [] } = useTeamMembers()
  const assigneeOptions = useMemo(
    () =>
      teamMembers.filter(
        // Owner/superadmin are excluded as an assignment *target* for anyone
        // else, but the current user can always assign a task to themselves —
        // enforce_task_assignment permits self-assignment regardless of role.
        (m) =>
          m.member_user_id === user?.id ||
          (m.system_role !== 'owner' && m.system_role !== 'superadmin'),
      ),
    [teamMembers, user?.id],
  )

  const { data: clientsData, isLoading: isLoadingClients } = useClients()
  const allClients = useMemo(() => {
    if (!clientsData) return []
    return [
      ...(clientsData.internalAccount ? [clientsData.internalAccount] : []),
      ...clientsData.realClients,
    ]
  }, [clientsData])
  const selectedClient = allClients.find((c) => c.id === selectedClientId)

  const { data: availableCampaigns = [], isLoading: loadingCampaigns } =
    useActiveCampaignsByClient(selectedClientId, { enabled: !campaignId })

  // Client selected → scope to that client's posts (fast). No client ("General")
  // → all deliverables across every client, each labelled with its client.
  const { data: availablePosts = [], isLoading: loadingPosts } =
    useDeliverableOptions(selectedClientId, { enabled: isOpen })
  const selectedPosts = availablePosts.filter((p) => postIds.includes(p.id))

  const createMutation = useCreateTask({
    onSuccess: () => {
      toast.success('Task added successfully')
      setIsOpen(false)
      onSuccess?.()
    },
    onError: (err) => toast.error('Failed to add task: ' + err.message),
  })
  const updateMutation = useUpdateTask({
    onSuccess: () => {
      toast.success('Task updated successfully')
      setIsOpen(false)
      onSuccess?.()
    },
    onError: (err) => toast.error('Failed to update task: ' + err.message),
  })
  const mutation = isEdit ? updateMutation : createMutation

  const onSubmit = (values) => {
    if (isEdit) {
      updateMutation.mutate({
        id: task.id,
        client_id: values.clientId || null,
        title: values.title,
        description: values.description.trim() || null,
        due_at: fromDateTimeLocal(values.dueAt),
        priority: values.priority,
        // Without the permission the assignee is left out entirely, so a save
        // cannot change it.
        ...(canAssignTasks ? { assigned_to: values.assignedTo || null } : {}),
        campaign_id: values.campaignId || null,
        post_ids: values.postIds,
      })
      return
    }
    createMutation.mutate({
      client_id: values.clientId || null,
      title: values.title,
      description: values.description.trim() || null,
      due_at: fromDateTimeLocal(values.dueAt),
      priority: values.priority,
      status: 'TODO',
      // Without the permission the form never sends an assignee at all.
      assigned_to: canAssignTasks ? values.assignedTo || null : null,
      ...(campaignId || values.campaignId ? { campaign_id: campaignId || values.campaignId } : {}),
      post_ids: values.postIds,
    })
  }

  const descRef = useRef(null)
  const autoResizeDesc = (e) => {
    e.target.style.height = 'auto'
    e.target.style.height = e.target.scrollHeight + 'px'
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden max-h-[85vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 space-y-0.5 shrink-0">
          <DialogTitle>{isEdit ? 'Edit Task' : 'Add Task'}</DialogTitle>
          <DialogDescription>
            Track work, set deadlines, and stay on top of what needs to get done.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col flex-1 min-h-0"
          >
            <div className="flex-1 overflow-y-auto min-h-0">
              {/* ── Writing area ── */}
              <div className="px-6 pt-6 pb-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="mb-3">
                      <FormControl>
                        <input
                          autoFocus
                          placeholder="Enter task title..."
                          className="w-full text-xl font-semibold bg-transparent border-none outline-none placeholder:text-muted-foreground/30 text-foreground"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <textarea
                      ref={descRef}
                      placeholder="Add a description..."
                      rows={2}
                      className="w-full text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/40 resize-none leading-relaxed text-muted-foreground focus:text-foreground transition-colors"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e)
                        autoResizeDesc(e)
                      }}
                    />
                  )}
                />
              </div>

              {/* ── Metadata rows ── */}
              <div className="border-t border-border/50 px-6 py-5 space-y-2">
                <MetaRow label="Client">
                  {!isEdit && lockClient && selectedClient ? (
                    <div className="flex items-center gap-2 text-sm">
                      <ClientAvatar client={selectedClient} size="sm" />
                      <span className="font-medium">{selectedClient.name}</span>
                    </div>
                  ) : (
                    <Select
                      value={selectedClientId || NONE}
                      onValueChange={(val) => {
                        form.setValue('clientId', val === NONE ? '' : val)
                        form.setValue('campaignId', '')
                        form.setValue('postIds', [])
                      }}
                      disabled={isLoadingClients}
                    >
                      <SelectTrigger aria-label="Client" className={triggerClass}>
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>
                          <span className="text-muted-foreground">General (no client)</span>
                        </SelectItem>
                        {allClients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex items-center gap-2">
                              <ClientAvatar client={c} size="sm" />
                              <span className="truncate">{c.name}</span>
                              {c.is_internal && (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-1">
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

                {/* One rule for both modes: only people who may assign Tasks can
                    choose an assignee. (tasks_insert RLS requires assigned_to IS
                    NULL OR is_workspace_admin(); tasks_update RLS is looser, so
                    this is a UI rule only.) Editing without the permission shows
                    who has the Task, read-only. */}
                {!canAssignTasks && isEdit && (
                  <MetaRow label="Assignee">
                    <span className="px-2 text-sm">
                      {(() => {
                        const current = teamMembers.find(
                          (m) => m.member_user_id === task.assigned_to,
                        )
                        return current
                          ? current.full_name || current.email
                          : task.assigned_to
                            ? '…'
                            : 'Unassigned'
                      })()}
                    </span>
                  </MetaRow>
                )}
                {canAssignTasks && (
                  <MetaRow label="Assignee">
                    <FormField
                      control={form.control}
                      name="assignedTo"
                      render={({ field }) => (
                        <Select
                          value={field.value || NONE}
                          onValueChange={(v) => field.onChange(v === NONE ? '' : v)}
                        >
                          <SelectTrigger aria-label="Assignee" className={triggerClass}>
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>
                              <span className="text-muted-foreground">Unassigned</span>
                            </SelectItem>
                            {assigneeOptions.map((m) => {
                              const rolePalette =
                                SYSTEM_ROLE_PALETTE[m.system_role] ?? SYSTEM_ROLE_PALETTE.member
                              return (
                                <SelectItem key={m.member_user_id} value={m.member_user_id}>
                                  <div className="flex items-center gap-2 w-full min-w-0 pr-1">
                                    <MemberAvatar
                                      member={m}
                                      size="size-5"
                                      className={cn('text-[9px]', m._removed && 'grayscale')}
                                    />
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
                      )}
                    />
                  </MetaRow>
                )}

                <MetaRow label="Priority">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <div className="flex items-center gap-1">
                        {TASK_PRIORITY_OPTIONS.map((p) => (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => field.onChange(p.value)}
                            className={cn(
                              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                              field.value === p.value
                                ? p.active
                                : 'text-muted-foreground hover:bg-muted/60',
                            )}
                          >
                            <span className={cn('size-1.5 rounded-full shrink-0', p.dot)} />
                            {p.label}
                          </button>
                        ))}
                      </div>
                    )}
                  />
                </MetaRow>

                <MetaRow label="Due date">
                  <FormField
                    control={form.control}
                    name="dueAt"
                    render={({ field }) => (
                      <input
                        type="datetime-local"
                        aria-label="Due date"
                        className="h-7 text-sm bg-transparent border-0 outline-none text-muted-foreground hover:text-foreground transition-colors px-2 rounded-md hover:bg-muted/60 cursor-pointer"
                        {...field}
                      />
                    )}
                  />
                </MetaRow>

                <MetaRow label="Campaign">
                  {!isEdit && campaignId ? (
                    <div className="flex items-center gap-1.5 px-2 text-sm text-foreground">
                      <Megaphone className="size-3 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{campaignName ?? 'Campaign'}</span>
                    </div>
                  ) : (
                    <FormField
                      control={form.control}
                      name="campaignId"
                      render={({ field }) => (
                        <Select
                          value={field.value || NONE}
                          onValueChange={(v) => field.onChange(v === NONE ? '' : v)}
                          disabled={!selectedClientId || loadingCampaigns}
                        >
                          <SelectTrigger aria-label="Campaign" className={triggerClass}>
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
                      )}
                    />
                  )}
                </MetaRow>

                {/* Deliverable — own row, full width */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs text-muted-foreground">Deliverable</span>
                  <DeliverablePickerSection
                    posts={availablePosts}
                    selectedPosts={selectedPosts}
                    onToggle={(post) =>
                      form.setValue(
                        'postIds',
                        postIds.includes(post.id)
                          ? postIds.filter((id) => id !== post.id)
                          : [...postIds, post.id],
                      )
                    }
                    onClear={() => form.setValue('postIds', [])}
                    showClient={!selectedClientId}
                    disabled={loadingPosts}
                  />
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="border-t border-border/50 px-6 py-4 flex items-center justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Task'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
