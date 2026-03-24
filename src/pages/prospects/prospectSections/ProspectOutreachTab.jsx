import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format, isToday, isYesterday } from 'date-fns'
import {
  Phone,
  Mail,
  MessageCircle,
  Video,
  StickyNote,
  ArrowRightLeft,
  Plus,
  Trash2,
  Search,
  X,
} from 'lucide-react'

import {
  useProspectActivities,
  useLogActivity,
  useDeleteActivity,
  ACTIVITY_TYPES,
} from '@/api/prospectActivities'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from '@/components/ui/empty'
import { cn } from '@/lib/utils'

// ── Type config ───────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  call: {
    icon:  Phone,
    label: 'Call',
    color: 'text-green-600 dark:text-green-400',
    bg:    'bg-green-100 dark:bg-green-950',
  },
  email: {
    icon:  Mail,
    label: 'Email',
    color: 'text-blue-600 dark:text-blue-400',
    bg:    'bg-blue-100 dark:bg-blue-950',
  },
  dm: {
    icon:  MessageCircle,
    label: 'DM',
    color: 'text-violet-600 dark:text-violet-400',
    bg:    'bg-violet-100 dark:bg-violet-950',
  },
  meeting: {
    icon:  Video,
    label: 'Meeting',
    color: 'text-amber-600 dark:text-amber-400',
    bg:    'bg-amber-100 dark:bg-amber-950',
  },
  note: {
    icon:  StickyNote,
    label: 'Note',
    color: 'text-gray-500 dark:text-gray-400',
    bg:    'bg-gray-100 dark:bg-gray-800',
  },
  status_change: {
    icon:  ArrowRightLeft,
    label: 'Status Change',
    color: 'text-muted-foreground',
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
  type:        z.string().min(1, 'Select a type'),
  body:        z.string().min(1, 'Add a description'),
  occurred_at: z.string().optional(),
})

// ── Activity card ─────────────────────────────────────────────────────────────

function ActivityCard({ activity, onDelete }) {
  const config = TYPE_CONFIG[activity.type] ?? TYPE_CONFIG.note
  const Icon   = config.icon
  const isStatusChange = activity.type === 'status_change'

  return (
    <div className={cn(
      'flex gap-3 px-4 py-3.5 group',
      isStatusChange && 'opacity-70'
    )}>
      {/* Icon */}
      <div className={cn('size-7 rounded-full flex items-center justify-center shrink-0 mt-0.5', config.bg)}>
        <Icon className={cn('size-3.5', config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className={cn('text-[11px] font-medium uppercase tracking-wider', config.color)}>
            {config.label}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {formatActivityDate(activity.occurred_at)}
          </span>
        </div>
        {activity.body && (
          <p className={cn(
            'text-sm leading-relaxed',
            isStatusChange ? 'text-muted-foreground italic' : 'text-foreground'
          )}>
            {activity.body}
          </p>
        )}
      </div>

      {/* Delete (manual entries only) */}
      {!isStatusChange && (
        <button
          onClick={() => onDelete(activity)}
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1 text-muted-foreground hover:text-destructive"
          title="Delete entry"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  )
}

// ── Log activity dialog form ──────────────────────────────────────────────────

function LogActivityDialog({ prospectId, open, onOpenChange }) {
  const logActivity = useLogActivity()

  const form = useForm({
    resolver: zodResolver(logSchema),
    defaultValues: {
      type:        'call',
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
      toast.success('Activity logged')
      form.reset({
        type:        'call',
        body:        '',
        occurred_at: toDatetimeLocal(new Date().toISOString()),
      })
      onOpenChange(false)
    } catch (err) {
      toast.error(err.message || 'Failed to log activity')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Activity</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Type */}
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full h-9 text-sm">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ACTIVITY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Date / time */}
              <FormField control={form.control} name="occurred_at" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Date & Time</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" className="h-9 text-sm" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Description */}
            <FormField control={form.control} name="body" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What happened? e.g. Had a 20-min intro call, discussed content needs..."
                    className="resize-none text-sm"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => { onOpenChange(false); form.reset() }}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={logActivity.isPending}>
                {logActivity.isPending ? 'Logging...' : 'Log Activity'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

// ── Type filter pills config ──────────────────────────────────────────────────

const TYPE_FILTERS = [
  { value: 'all',           label: 'All' },
  { value: 'call',          label: 'Calls' },
  { value: 'email',         label: 'Emails' },
  { value: 'dm',            label: 'DMs' },
  { value: 'meeting',       label: 'Meetings' },
  { value: 'note',          label: 'Notes' },
  { value: 'status_change', label: 'Status Changes' },
]

// ── Main Tab ──────────────────────────────────────────────────────────────────

export default function ProspectOutreachTab({ prospectId }) {
  const { data: activities = [], isLoading } = useProspectActivities(prospectId)
  const deleteActivity = useDeleteActivity()
  const [deletingActivity, setDeletingActivity] = useState(null)
  const [logOpen, setLogOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  async function handleDelete() {
    if (!deletingActivity) return
    try {
      await deleteActivity.mutateAsync({
        id:          deletingActivity.id,
        prospect_id: prospectId,
      })
      toast.success('Activity deleted')
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setDeletingActivity(null)
    }
  }

  // Filter activities
  const filtered = useMemo(() => {
    let result = activities
    if (typeFilter !== 'all') {
      result = result.filter((a) => a.type === typeFilter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((a) => a.body?.toLowerCase().includes(q))
    }
    return result
  }, [activities, typeFilter, search])

  const isFiltered = search !== '' || typeFilter !== 'all'

  // Group activities by date label
  function groupByDate(items) {
    const groups = {}
    items.forEach((item) => {
      const d = new Date(item.occurred_at)
      const key = isToday(d)
        ? 'Today'
        : isYesterday(d)
        ? 'Yesterday'
        : format(d, 'd MMMM yyyy')
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
    })
    return groups
  }

  const grouped = groupByDate(filtered)

  return (
    <div className="pt-4 space-y-4">
      {/* Header row */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search activity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-8 text-sm bg-muted/20 border border-border/40 rounded-lg focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {/* Type filter */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-36 text-sm bg-muted/20 border-border/40">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setLogOpen(true)}>
            <Plus className="size-3.5" />
            Log Activity
          </Button>
        </div>
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 px-4 py-3.5">
              <Skeleton className="size-7 rounded-full shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Empty className="py-16 border border-dashed rounded-2xl bg-muted/5">
          <EmptyContent>
            <div className="text-4xl leading-none select-none mb-2">💬</div>
            <EmptyHeader>
              <EmptyTitle className="font-normal text-lg">
                {isFiltered ? 'No matching activity' : 'No activity yet'}
              </EmptyTitle>
              <EmptyDescription className="font-normal">
                {isFiltered
                  ? 'Try adjusting your search or filter.'
                  : 'Log your first outreach — calls, emails, DMs, or meetings.'}
              </EmptyDescription>
            </EmptyHeader>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              {/* Date group header */}
              <div className="px-4 py-2 bg-muted/30 border-b border-border/40">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {dateLabel}
                </span>
              </div>
              {/* Activity cards */}
              <div className="divide-y divide-border/30">
                {items.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    onDelete={setDeletingActivity}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Log activity dialog */}
      <LogActivityDialog
        prospectId={prospectId}
        open={logOpen}
        onOpenChange={setLogOpen}
      />

      {/* Delete confirm */}
      <AlertDialog
        open={!!deletingActivity}
        onOpenChange={(v) => !v && setDeletingActivity(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this activity log entry.
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
