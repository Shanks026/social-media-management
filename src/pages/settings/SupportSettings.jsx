import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useSubscription } from '@/api/useSubscription'
import { useMyFeedback, useSubmitFeedback, useDismissFeedback } from '@/api/feedback'
import { formatDate } from '@/lib/helper'
import { cn } from '@/lib/utils'

// UI
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

// Icons
import {
  Bug,
  Lightbulb,
  Loader2,
  Clock,
  CheckCircle2,
  CircleDot,
  XCircle,
  CircleOff,
  BookMarked,
  Rocket,
  Ban,
  X,
} from 'lucide-react'

// ─── Schemas ───────────────────────────────────────────────────────────────────

const bugSchema = z.object({
  title: z.string().min(1, 'Please give the issue a short title').max(150),
  feature_area: z.string().min(1, 'Please select where this happened'),
  severity: z.enum(['low', 'medium', 'high', 'critical'], {
    required_error: 'Please select how urgent this is',
  }),
  description: z.string().min(20, 'Please describe what happened in a bit more detail'),
  steps_to_reproduce: z.string().optional(),
})

const suggestionSchema = z.object({
  title: z.string().min(1, 'Please give your idea a short title').max(150),
  category: z.enum(['feature_request', 'ux_improvement', 'performance', 'general'], {
    required_error: 'Please select the type of feedback',
  }),
  description: z.string().min(20, 'Please describe your idea in a bit more detail'),
  expected_benefit: z.string().optional(),
})

// ─── Constants ─────────────────────────────────────────────────────────────────

const FEATURE_AREAS = [
  'Dashboard', 'Clients', 'Posts', 'Calendar', 'Proposals',
  'Campaigns', 'Finance', 'Documents', 'Operations', 'Settings', 'Other',
]

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Minor annoyance' },
  { value: 'medium', label: "It's slowing me down" },
  { value: 'high', label: "I can't complete my work" },
  { value: 'critical', label: "I'm completely blocked" },
]

const CATEGORY_OPTIONS = [
  { value: 'feature_request', label: 'I have a new idea' },
  { value: 'ux_improvement', label: 'Something could work better' },
  { value: 'performance', label: 'Something feels off' },
  { value: 'general', label: 'Other' },
]

const CATEGORY_LABELS = {
  feature_request: 'New idea',
  ux_improvement: 'Improvement',
  performance: 'Something feels off',
  general: 'General',
}

const SEVERITY_LABELS = {
  low: 'Minor annoyance',
  medium: 'Slowing me down',
  high: "Can't complete work",
  critical: 'Completely blocked',
}

// ─── Status config ─────────────────────────────────────────────────────────────

const BUG_STATUS_CONFIG = {
  open: { label: 'Open', icon: CircleDot, className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  in_progress: { label: 'In Progress', icon: Loader2, className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  resolved: { label: 'Resolved', icon: CheckCircle2, className: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  closed: { label: 'Closed', icon: XCircle, className: 'bg-muted text-muted-foreground' },
  wont_fix: { label: "Won't Fix", icon: CircleOff, className: 'bg-muted text-muted-foreground' },
}

const SUGGESTION_STATUS_CONFIG = {
  received: { label: 'Received', icon: Clock, className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  under_review: { label: 'Under Review', icon: BookMarked, className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  planned: { label: 'Planned', icon: Rocket, className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  implemented: { label: 'Implemented', icon: CheckCircle2, className: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  declined: { label: 'Declined', icon: Ban, className: 'bg-muted text-muted-foreground' },
}

// ─── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ type, status }) {
  const config =
    type === 'bug_report' ? BUG_STATUS_CONFIG[status] : SUGGESTION_STATUS_CONFIG[status]
  if (!config) return null
  const Icon = config.icon
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', config.className)}>
      <Icon className="size-3" />
      {config.label}
    </span>
  )
}

const TERMINAL_STATUSES = new Set(['resolved', 'closed', 'wont_fix', 'implemented', 'declined'])

// ─── SubmissionCard ─────────────────────────────────────────────────────────────

function SubmissionCard({ item }) {
  const isBug = item.type === 'bug_report'
  const dismiss = useDismissFeedback()
  const canDismiss = TERMINAL_STATUSES.has(item.status)

  return (
    <div className="flex items-start gap-4 rounded-xl border border-border/50 bg-card/30 px-5 py-4">
      <div className={cn(
        'size-10 rounded-xl flex items-center justify-center shrink-0',
        isBug ? 'bg-red-500/10' : 'bg-purple-500/10',
      )}>
        {isBug
          ? <Bug className="size-4 text-red-500" />
          : <Lightbulb className="size-4 text-purple-500" />
        }
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium truncate">{item.title}</p>
        <p className="text-xs text-muted-foreground">
          {isBug && item.severity ? SEVERITY_LABELS[item.severity] : null}
          {!isBug && item.category ? CATEGORY_LABELS[item.category] : null}
        </p>
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <StatusBadge type={item.type} status={item.status} />
          {canDismiss && (
            <button
              onClick={() => dismiss.mutate(item.id)}
              disabled={dismiss.isPending}
              className="text-muted-foreground/50 hover:text-muted-foreground transition-colors disabled:opacity-50"
              title="Dismiss"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
      </div>
    </div>
  )
}

// ─── SubmissionHistory ──────────────────────────────────────────────────────────

function SubmissionHistory({ type }) {
  const { data: allItems = [], isLoading } = useMyFeedback()
  const items = allItems.filter((i) => i.type === type)

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((n) => (
          <div key={n} className="h-[72px] rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground font-light py-2">
        {type === 'bug_report'
          ? "You haven't reported any bugs yet."
          : "You haven't submitted any suggestions yet."}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <SubmissionCard key={item.id} item={item} />
      ))}
    </div>
  )
}

// ─── BugReportForm ──────────────────────────────────────────────────────────────

function BugReportForm() {
  const { user } = useAuth()
  const { data: sub } = useSubscription()
  const submitFeedback = useSubmitFeedback()

  const form = useForm({
    resolver: zodResolver(bugSchema),
    defaultValues: {
      title: '',
      feature_area: '',
      severity: undefined,
      description: '',
      steps_to_reproduce: '',
    },
  })

  async function onSubmit(values) {
    try {
      await submitFeedback.mutateAsync({
        type: 'bug_report',
        planName: sub?.plan_name ?? null,
        submitterEmail: user?.email ?? null,
        agencyName: sub?.agency_name ?? null,
        userName: user?.user_metadata?.full_name ?? null,
        ...values,
        steps_to_reproduce: values.steps_to_reproduce || null,
      })
      toast.success("Thanks for the report — we'll look into it.")
      form.reset()
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-xl">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What's the issue?</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Invoice PDF not downloading" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="feature_area"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Where did this happen?</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a section" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {FEATURE_AREAS.map((area) => (
                    <SelectItem key={area} value={area}>{area}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="severity"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>How urgent is this?</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                >
                  {SEVERITY_OPTIONS.map((opt) => (
                    <Label
                      key={opt.value}
                      htmlFor={`severity-${opt.value}`}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 border rounded-xl cursor-pointer transition-colors font-normal',
                        field.value === opt.value
                          ? 'border-foreground bg-foreground/5'
                          : 'border-border/50 bg-card/30 hover:border-foreground/30',
                      )}
                    >
                      <RadioGroupItem id={`severity-${opt.value}`} value={opt.value} />
                      <span className="text-sm">{opt.label}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tell us what happened</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="What were you doing and what went wrong?"
                  className="min-h-[100px] resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="steps_to_reproduce"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Anything else that might help?{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Steps, context, or anything else that might help us reproduce the issue…"
                  className="min-h-[80px] resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" size="sm" disabled={form.formState.isSubmitting} className="gap-2">
          {form.formState.isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
          Submit Report
        </Button>
      </form>
    </Form>
  )
}

// ─── SuggestionForm ─────────────────────────────────────────────────────────────

function SuggestionForm() {
  const { user } = useAuth()
  const { data: sub } = useSubscription()
  const submitFeedback = useSubmitFeedback()

  const form = useForm({
    resolver: zodResolver(suggestionSchema),
    defaultValues: {
      title: '',
      category: undefined,
      description: '',
      expected_benefit: '',
    },
  })

  async function onSubmit(values) {
    try {
      await submitFeedback.mutateAsync({
        type: 'suggestion',
        planName: sub?.plan_name ?? null,
        submitterEmail: user?.email ?? null,
        agencyName: sub?.agency_name ?? null,
        userName: user?.user_metadata?.full_name ?? null,
        ...values,
        expected_benefit: values.expected_benefit || null,
      })
      toast.success('Thanks for the feedback — we really appreciate it.')
      form.reset()
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-xl">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What's your idea?</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Let me duplicate a campaign" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What type of feedback is this?</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tell us more</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe your idea or what you'd like to see changed…"
                  className="min-h-[100px] resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="expected_benefit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                What would this allow you to do?{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g. Save time when starting similar campaigns for different clients…"
                  className="min-h-[80px] resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" size="sm" disabled={form.formState.isSubmitting} className="gap-2">
          {form.formState.isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
          Submit Feedback
        </Button>
      </form>
    </Form>
  )
}

// ─── SupportSettings ────────────────────────────────────────────────────────────

export default function SupportSettings() {
  return (
    <div className="w-full space-y-8">

      <div className="space-y-1">
        <h2 className="text-2xl font-normal tracking-tight">Support</h2>
        <p className="text-sm text-muted-foreground font-light">
          Report a bug or share an idea — we read everything.
        </p>
      </div>

      <Tabs defaultValue="bug" className="space-y-10">
        <TabsList className="grid grid-cols-2 h-8 w-full sm:max-w-xs text-xs">
          <TabsTrigger value="bug" className="gap-1.5 text-xs">
            <Bug className="size-3" />
            Report a Bug
          </TabsTrigger>
          <TabsTrigger value="suggestion" className="gap-1.5 text-xs">
            <Lightbulb className="size-3" />
            Share Feedback
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bug" className="focus-visible:outline-none space-y-12">
          <section className="space-y-8">
            <div className="space-y-1">
              <h2 className="text-2xl font-normal tracking-tight">Report a Bug</h2>
              <p className="text-sm text-muted-foreground font-light">
                Something not working as expected? Let us know and we'll get it fixed.
              </p>
            </div>
            <BugReportForm />
          </section>

          <section className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-normal tracking-tight">Your past reports</h2>
              <p className="text-sm text-muted-foreground font-light">Track the status of bugs you've reported.</p>
            </div>
            <SubmissionHistory type="bug_report" />
          </section>
        </TabsContent>

        <TabsContent value="suggestion" className="focus-visible:outline-none space-y-12">
          <section className="space-y-8">
            <div className="space-y-1">
              <h2 className="text-2xl font-normal tracking-tight">Share Feedback</h2>
              <p className="text-sm text-muted-foreground font-light">
                Have an idea or suggestion? We'd love to hear it.
              </p>
            </div>
            <SuggestionForm />
          </section>

          <section className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-normal tracking-tight">Your past suggestions</h2>
              <p className="text-sm text-muted-foreground font-light">Track the status of feedback you've shared.</p>
            </div>
            <SubmissionHistory type="suggestion" />
          </section>
        </TabsContent>
      </Tabs>

    </div>
  )
}
