import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns'
import {
  Phone,
  Mail,
  MessageCircle,
  Instagram,
  Handshake,
  Ellipsis,
  ArrowRightLeft,
  Plus,
  Trash2,
  X,
} from 'lucide-react'

import {
  useProspectActivities,
  useLogActivity,
  useDeleteActivity,
  ACTIVITY_TYPES,
} from '@/api/prospectActivities'
import { PROSPECT_STATUS_CONFIG } from '@/components/prospects/ProspectStatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
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
import { cn } from '@/lib/utils'

// ── Type config ───────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  whatsapp: {
    icon:  MessageCircle,
    label: 'WhatsApp',
    color: 'text-green-600 dark:text-green-400',
    bg:    'bg-green-100 dark:bg-green-950',
  },
  instagram: {
    icon:  Instagram,
    label: 'Instagram',
    color: 'text-pink-600 dark:text-pink-400',
    bg:    'bg-pink-100 dark:bg-pink-950',
  },
  email: {
    icon:  Mail,
    label: 'Email',
    color: 'text-blue-600 dark:text-blue-400',
    bg:    'bg-blue-100 dark:bg-blue-950',
  },
  call: {
    icon:  Phone,
    label: 'Call',
    color: 'text-indigo-600 dark:text-indigo-400',
    bg:    'bg-indigo-100 dark:bg-indigo-950',
  },
  inperson: {
    icon:  Handshake,
    label: 'In Person',
    color: 'text-amber-600 dark:text-amber-400',
    bg:    'bg-amber-100 dark:bg-amber-950',
  },
  others: {
    icon:  Ellipsis,
    label: 'Others',
    color: 'text-gray-500 dark:text-gray-400',
    bg:    'bg-gray-100 dark:bg-gray-800',
  },
  status_change: {
    icon:  ArrowRightLeft,
    label: 'Status Change',
    color: 'text-foreground',
    bg:    'bg-muted/60',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatActivityDate(isoString) {
  const d = new Date(isoString)
  if (isToday(d))     return `Today · ${format(d, 'h:mm a')}`
  if (isYesterday(d)) return `Yesterday · ${format(d, 'h:mm a')}`
  return format(d, 'd MMM yyyy · h:mm a')
}

function toDatetimeLocal(isoString) {
  if (!isoString) return ''
  return isoString.slice(0, 16)
}

// ── Log form schema ───────────────────────────────────────────────────────────

const logSchema = z.object({
  type:        z.string().min(1, 'Select a channel'),
  body:        z.string().optional(),
  occurred_at: z.string().optional(),
})

// ── Timeline marker (ring + dot, connector line) ──────────────────────────────

function TimelineMarker({ className }) {
  return (
    <div className={cn('flex flex-col items-center shrink-0', className)}>
      <div className="size-3.5 rounded-full border-2 border-muted-foreground/40 bg-background flex items-center justify-center shrink-0">
        <div className="size-1 rounded-full bg-muted-foreground/60" />
      </div>
      <div className="w-px flex-1 bg-border/60 mt-1 group-last:hidden" />
    </div>
  )
}

// ── Inline log form ───────────────────────────────────────────────────────────

function LogOutreachForm({ prospectId, onClose }) {
  const logActivity = useLogActivity()

  const form = useForm({
    resolver: zodResolver(logSchema),
    defaultValues: {
      type:        'whatsapp',
      body:        '',
      occurred_at: toDatetimeLocal(new Date().toISOString()),
    },
  })

  async function onSubmit(values) {
    try {
      await logActivity.mutateAsync({
        prospect_id: prospectId,
        type:        values.type,
        body:        values.body,
        occurred_at: values.occurred_at
          ? new Date(values.occurred_at).toISOString()
          : new Date().toISOString(),
      })
      toast.success('Outreach logged')
      onClose()
    } catch (err) {
      toast.error(err.message || 'Failed to log outreach')
    }
  }

  return (
    <div className="rounded-xl border border-border/80 bg-muted/20 p-5">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Channel */}
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-muted-foreground">Channel</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full h-9 text-sm bg-background">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ACTIVITY_TYPES.map((t) => {
                      const Icon = TYPE_CONFIG[t.value]?.icon ?? Ellipsis
                      return (
                        <SelectItem key={t.value} value={t.value}>
                          <span className="flex items-center gap-2">
                            <Icon className={cn('size-3.5', TYPE_CONFIG[t.value]?.color)} />
                            {t.label}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Date / time */}
            <FormField control={form.control} name="occurred_at" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-muted-foreground">Date &amp; Time</FormLabel>
                <FormControl>
                  <Input type="datetime-local" className="h-9 text-sm bg-background" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          {/* Note */}
          <FormField control={form.control} name="body" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground">
                Note <span className="text-muted-foreground/60">(optional)</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="What happened, what was discussed…"
                  className="resize-none text-sm bg-background"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={logActivity.isPending}>
              {logActivity.isPending ? 'Saving…' : 'Save entry'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

// ── Outreach timeline entry ───────────────────────────────────────────────────

function OutreachEntry({ activity, onDelete }) {
  const config = TYPE_CONFIG[activity.type] ?? TYPE_CONFIG.others
  const Icon   = config.icon

  return (
    <div className="flex gap-3 group">
      <TimelineMarker className="pt-4" />

      {/* Card */}
      <div className="flex-1 min-w-0 rounded-xl border border-border/80 bg-card p-4 mb-3 relative">
        <span className={cn('flex items-center gap-1.5 text-sm font-semibold', config.color)}>
          <Icon className="size-3.5" />
          {config.label}
        </span>

        {activity.body && (
          <p className="text-sm leading-relaxed text-foreground/70 mt-1.5">
            {activity.body}
          </p>
        )}

        <p className="text-xs text-muted-foreground/70 mt-2">
          {formatActivityDate(activity.occurred_at)}
          {' · '}
          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
        </p>

        <button
          onClick={() => onDelete(activity)}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          title="Delete entry"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Status activity entry ─────────────────────────────────────────────────────

function StatusEntry({ activity }) {
  const toStatus = activity.metadata?.to_status
  const statusConfig = toStatus ? PROSPECT_STATUS_CONFIG[toStatus] : null

  return (
    <div className="flex gap-3 group">
      <TimelineMarker className="pt-0.5" />

      <div className="flex-1 min-w-0 pb-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Moved to</span>
          {statusConfig && (
            <Badge
              variant="outline"
              className={cn('text-[11px] font-medium whitespace-nowrap py-0.5 px-2', statusConfig.className)}
            >
              {statusConfig.label}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {formatActivityDate(activity.occurred_at)}
        </p>
      </div>
    </div>
  )
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

export default function ProspectOutreachTab({ prospectId }) {
  const { data: activities = [], isLoading } = useProspectActivities(prospectId)
  const deleteActivity = useDeleteActivity()
  const [deletingActivity, setDeletingActivity] = useState(null)
  const [formOpen, setFormOpen] = useState(false)

  const outreach = useMemo(
    () => activities.filter((a) => a.type !== 'status_change'),
    [activities]
  )
  const statusChanges = useMemo(
    () => activities.filter((a) => a.type === 'status_change'),
    [activities]
  )

  async function handleDelete() {
    if (!deletingActivity) return
    try {
      await deleteActivity.mutateAsync({
        id:          deletingActivity.id,
        prospect_id: prospectId,
      })
      toast.success('Entry deleted')
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setDeletingActivity(null)
    }
  }

  return (
    <div className="pt-4 grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* ── Left: Outreach Log (2/3) ──────────────────────────────────────── */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Outreach Log
          </h2>
          <Button
            size="sm"
            variant={formOpen ? 'outline' : 'default'}
            className="h-7 px-2.5 text-xs gap-1"
            onClick={() => setFormOpen((o) => !o)}
          >
            {formOpen ? <X className="size-3" /> : <Plus className="size-3" />}
            {formOpen ? 'Cancel' : 'Log outreach'}
          </Button>
        </div>

        {formOpen && (
          <LogOutreachForm prospectId={prospectId} onClose={() => setFormOpen(false)} />
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-5 rounded-full shrink-0 mt-4" />
                <Skeleton className="h-20 flex-1 rounded-xl" />
              </div>
            ))}
          </div>
        ) : outreach.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 gap-2 rounded-2xl border border-dashed border-border/50 bg-muted/5">
            <div className="text-4xl leading-none select-none mb-1">💬</div>
            <p className="text-base font-normal text-foreground">No outreach yet</p>
            <p className="text-sm text-muted-foreground">
              Log your first touchpoint — WhatsApp, Instagram, email, call, or in person.
            </p>
          </div>
        ) : (
          <div>
            {outreach.map((activity) => (
              <OutreachEntry
                key={activity.id}
                activity={activity}
                onDelete={setDeletingActivity}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Right: Pipeline Activity (1/3) ────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Pipeline Activity
        </h2>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-5 rounded-full shrink-0 mt-3" />
                <Skeleton className="h-8 flex-1 rounded-lg" />
              </div>
            ))}
          </div>
        ) : statusChanges.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 gap-1.5 rounded-2xl border border-dashed border-border/50 bg-muted/5">
            <ArrowRightLeft className="size-5 text-muted-foreground/50 mb-1" />
            <p className="text-sm text-muted-foreground">No status changes yet</p>
          </div>
        ) : (
          <div>
            {statusChanges.map((activity) => (
              <StatusEntry key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deletingActivity}
        onOpenChange={(v) => !v && setDeletingActivity(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this outreach log entry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
