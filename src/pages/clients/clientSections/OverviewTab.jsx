import React, { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Plus,
  FileText,
  Calendar as CalendarIcon,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Bell,
  Circle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  CircleDollarSign,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LabelList,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { SUPPORTED_PLATFORMS } from '@/lib/platforms'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAllPostsByClient } from '@/api/posts'
import { useInvoices } from '@/api/invoices'
import { fetchUpcomingMeetings, deleteMeeting } from '@/api/meetings'
import { useClientMetrics } from '@/api/clients'
import { useTransactions, useFinanceOverview } from '@/api/transactions'
import { useExpenses, useBurnRate } from '@/api/expenses'
import { toast } from 'sonner'
import { calculatePeriodMetrics, formatCurrency } from '@/utils/finance'
import {
  format,
  isToday,
  isTomorrow,
  differenceInDays,
  startOfMonth,
  endOfMonth,
} from 'date-fns'
import {
  fetchClientNotes,
  fetchInternalClientNotes,
  updateNoteStatus,
} from '@/api/notes'

// Dialogs
import CreateDraftPost from '../../posts/DraftPostForm'
import { CreateInvoiceDialog } from '../../finance/CreateInvoiceDialog'
import CreateMeetingDialog from '@/components/CreateMeetingDialog'
import CreateNoteDialog from '@/components/CreateNoteDialog'
import { AddTransactionDialog } from '@/pages/finance/AddTransactionDialog'
import NoteRow from '@/components/NoteRow'

const platformChartConfig = {
  posts: { label: 'Posts' },
  ...SUPPORTED_PLATFORMS.reduce((acc, p) => {
    acc[p.id] = { label: p.label, color: p.color }
    return acc
  }, {}),
}

// 1. Direct Tailwind Colors Configuration for Shadcn Chart
const chartConfig = {
  DRAFT: { label: 'Draft', color: '#3b82f6' }, // Tailwind blue-500
  'PENDING APPROVAL': { label: 'Pending Approval', color: '#f97316' }, // Tailwind orange-500
  'NEEDS REVISION': { label: 'Needs Revision', color: '#ec4899' }, // Tailwind pink-500
  SCHEDULED: { label: 'Scheduled', color: '#a855f7' }, // Tailwind purple-500
  PUBLISHED: { label: 'Published', color: '#10b981' }, // Tailwind emerald-500
}

const ALLOWED_STATUSES = [
  'DRAFT',
  'PENDING APPROVAL',
  'NEEDS REVISION',
  'SCHEDULED',
  'PUBLISHED',
]

// Custom Y-Axis tick to render platform icons instead of text
const CustomPlatformTick = ({ x, y, payload }) => {
  return (
    <g transform={`translate(${x - 30},${y - 12})`}>
      <image
        href={`/platformIcons/${payload.value}.png`}
        height="24"
        width="24"
      />
    </g>
  )
}

export default function OverviewTab({ client }) {
  // Dialog States
  const [createPostOpen, setCreatePostOpen] = useState(false)
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false)
  const [createTransactionOpen, setCreateTransactionOpen] = useState(false)
  const [invoicePrefill, setInvoicePrefill] = useState(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // Edit Meeting Dialog State
  const [editingMeeting, setEditingMeeting] = useState(null)

  const queryClient = useQueryClient()

  // Data Fetching
  const { data: posts = [], isLoading: isLoadingPosts } = useQuery({
    queryKey: ['posts', client.id],
    queryFn: () => fetchAllPostsByClient(client.id),
  })

  // Compute platform distribution for the Mixed Bar Chart
  const platformData = React.useMemo(() => {
    const counts = {}

    // Always initialize all supported platforms to 0
    SUPPORTED_PLATFORMS.forEach((p) => {
      counts[p.id] = 0
    })

    if (posts && posts.length > 0) {
      posts.forEach((post) => {
        const plats = Array.isArray(post.platform)
          ? post.platform
          : post.platform
            ? [post.platform]
            : []
        plats.forEach((p) => {
          const platformId = p?.toLowerCase()
          if (counts[platformId] !== undefined) {
            counts[platformId] += 1
          }
        })
      })
    }

    return SUPPORTED_PLATFORMS.map((sp) => ({
      platform: sp.id, // We use this for the image payload
      label: sp.label,
      posts: counts[sp.id],
      fill: `var(--color-${sp.id})`,
    })).sort((a, b) => b.posts - a.posts)
  }, [posts])

  // We fetch all invoices to calculate pending ones and MRR (latest monthly retainer)
  const { data: invoices = [], isLoading: isLoadingInvoices } = useInvoices(
    { clientId: client.id },
    { enabled: !client?.is_internal },
  )

  const { data: upcomingMeetings = [], isLoading: isLoadingMeetings } =
    useQuery({
      queryKey: ['upcomingMeetings', client.id],
      queryFn: () => fetchUpcomingMeetings(client.id, 10),
    })

  // Notes — internal client also pulls in legacy notes with client_id IS NULL
  const { data: notes = [], isLoading: isLoadingNotes } = useQuery({
    queryKey: ['client-notes', client.id],
    queryFn: () =>
      client.is_internal
        ? fetchInternalClientNotes(client.id)
        : fetchClientNotes(client.id),
  })

  // Toast logic for reminders
  const notifiedNotesRef = React.useRef(
    new Set(JSON.parse(localStorage.getItem('notifiedNoteIds') || '[]')),
  )
  React.useEffect(() => {
    if (!notes || notes.length === 0) return

    notes.forEach((note) => {
      if (note.status === 'TODO' && note.due_at) {
        const dueDate = new Date(note.due_at)
        const timeDiffMs = dueDate.getTime() - new Date().getTime()
        const hoursDiff = timeDiffMs / (1000 * 60 * 60)

        if (
          hoursDiff > 0 &&
          hoursDiff <= 24 &&
          !notifiedNotesRef.current.has(note.id)
        ) {
          toast.info(
            `Reminder: "${note.title}" is due in ${Math.round(hoursDiff)} hours!`,
            {
              icon: <Bell className="h-4 w-4 text-yellow-400" />,
              duration: 8000,
            },
          )
          notifiedNotesRef.current.add(note.id)
          // Persist to localStorage so it survives remounts
          localStorage.setItem(
            'notifiedNoteIds',
            JSON.stringify([...notifiedNotesRef.current]),
          )
        }
      }
    })
  }, [notes])
  // Notes Mutation
  const { mutate: toggleNoteStatus, isPending: isTogglingNote } = useMutation({
    mutationFn: ({ noteId, newStatus }) => updateNoteStatus(noteId, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-notes', client.id] })
    },
    onError: (error) => {
      toast.error('Failed to update note: ' + error.message)
    },
  })

  // Financial Metrics (for external client card — from DB view, all-time)
  const { data: metrics, isLoading: isLoadingMetrics } = useClientMetrics(
    client.id,
  )

  // Stabilize date objects to prevent useMemo/useQuery churn on every render.
  const start = React.useMemo(() => startOfMonth(new Date()), [])
  const end = React.useMemo(() => endOfMonth(new Date()), [])

  // For internal client: use the same proven hooks as Finance → All tab.
  // useFinanceOverview reads from view_finance_overview (DB pre-aggregation).
  // useBurnRate reads from view_monthly_burn_rate.
  // Both are disabled for external clients to avoid wasteful requests.
  const { data: financeOverview, isLoading: isLoadingFinanceOverview } =
    useFinanceOverview()
  const { data: burnRate = 0, isLoading: isLoadingBurnRate } = useBurnRate()

  // Derive agency-wide metrics for the internal client card.
  // revenue = all PAID INCOME transactions (all-time cash)
  // expenses = all one-off EXPENSE transactions + monthly recurring burn
  const agencyRevenue = Number(financeOverview?.total_income ?? 0)
  const agencyOneOff = Number(financeOverview?.total_one_off_expenses ?? 0)
  const agencyBurn = Number(burnRate)
  const agencyExpenses = agencyOneOff + agencyBurn
  const agencyNetProfit = agencyRevenue - agencyExpenses
  const isLoadingAgencyMetrics = isLoadingFinanceOverview || isLoadingBurnRate

  // For external client card: client-scoped transactions & expenses (current month)
  const { data: transactions = [] } = useTransactions({
    clientId: client.id,
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd'),
  })

  const { data: expenses = [] } = useExpenses({
    clientId: client.id,
  })

  const {
    data: recentTransactions = [],
    isLoading: isLoadingRecentTransactions,
  } = useTransactions({
    clientId: client.id,
    limit: 5,
  })

  // --- Calculations ---

  // 1. Workflow Health
  const postCounts = ALLOWED_STATUSES.reduce((acc, status) => {
    acc[status] = 0
    return acc
  }, {})

  posts.forEach((post) => {
    const status = post.status?.replace('_', ' ') || 'DRAFT'
    if (ALLOWED_STATUSES.includes(status)) {
      postCounts[status] += 1
    }
  })

  const chartData = ALLOWED_STATUSES.map((name) => ({
    name,
    value: postCounts[name],
    fill: chartConfig[name].color,
  }))

  // Filter out the zero values specifically for the Pie chart to avoid uneven padding accumulation
  const pieChartData = chartData.filter((d) => d.value > 0)

  const totalPosts = posts.filter((post) => {
    const status = post.status?.replace('_', ' ') || 'DRAFT'
    return ALLOWED_STATUSES.includes(status)
  }).length

  const needsRevisionCount = postCounts['NEEDS REVISION'] || 0
  const pendingApprovalCount = postCounts['PENDING APPROVAL'] || 0

  // 2. Financials
  // "Pending" meaning Sent or Overdue (not Draft, not Paid)
  const pendingInvoices = invoices.filter(
    (inv) => inv.status === 'SENT' || inv.status === 'OVERDUE',
  )
  const pendingInvoicesTotal = pendingInvoices.reduce(
    (sum, inv) => sum + Number(inv.total || 0),
    0,
  )

  // MRR estimation based on latest 'Monthly Retainer' from both invoices and transactions
  const retainerInvoices = invoices.filter(
    (inv) => inv.category === 'Monthly Retainer',
  )
  const retainerTransactions = transactions.filter(
    (t) => t.category === 'Monthly Retainer' && t.type === 'INCOME',
  )

  // Combine and sort by date descending to find the most recent retainer amount
  const allRetainers = [
    ...retainerInvoices.map((inv) => ({
      date: new Date(inv.issue_date),
      amount: Number(inv.total),
    })),
    ...retainerTransactions.map((t) => ({
      date: new Date(t.date),
      amount: Number(t.amount),
    })),
  ].sort((a, b) => b.date - a.date)

  const mrr = allRetainers.length > 0 ? allRetainers[0].amount : 0

  const currentMetrics = calculatePeriodMetrics({
    transactions,
    expenses,
    periodStart: start,
    periodEnd: end,
    method: 'CASH',
  })

  const margin = currentMetrics.margin

  // All-time net profit from DB view (for external client card)
  const clientNetProfit =
    (metrics?.total_revenue || 0) -
    (metrics?.one_off_costs || 0) -
    (metrics?.monthly_recurring_costs || 0)
  const clientNetProfitPositive = clientNetProfit >= 0

  // Margin Conditional Formatting
  let marginColorClass = 'text-primary'
  if (margin === 0) {
    marginColorClass = 'text-primary'
  } else if (margin >= 50) {
    marginColorClass = 'text-emerald-600 dark:text-emerald-500'
  } else if (margin < 20) {
    marginColorClass = 'text-rose-600 dark:text-rose-500'
  } else {
    marginColorClass = 'text-amber-600 dark:text-amber-500'
  }

  // 3. Mutations
  const { mutate: markMeetingDone, isPending: isCompletingMeeting } =
    useMutation({
      mutationFn: (meetingId) => deleteMeeting(meetingId),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['upcomingMeetings', client.id],
        })
        queryClient.invalidateQueries({ queryKey: ['meetings'] })
        queryClient.invalidateQueries({ queryKey: ['todayMeetings'] })
        toast.success('Meeting marked as done')
      },
      onError: (error) => {
        toast.error('Failed to update meeting: ' + error.message)
      },
    })

  const visibleNotes = notes.filter((n) => n.status !== 'ARCHIVED').slice(0, 3)
  const extraNotes = notes.filter((n) => n.status !== 'ARCHIVED').length - 2

  const NotesCard = (
    <Card className="@container border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex flex-col gap-2 h-full">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          Notes & Reminders
        </CardTitle>
        <CreateNoteDialog clientId={client.id} lockClient={true}>
          <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
            <Plus className="h-4 w-4" />
          </Button>
        </CreateNoteDialog>
      </CardHeader>
      <CardContent className="flex flex-col flex-1">
        {isLoadingNotes ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-start gap-3 py-1">
                <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : visibleNotes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-2">
            <div className="h-10 w-10 border border-dashed rounded-full flex items-center justify-center text-muted-foreground">
              <FileText className="h-4 w-4 opacity-50" />
            </div>
            <p className="text-sm text-muted-foreground">No pending notes</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 mt-2">
            <div className="flex flex-col gap-3">
              {visibleNotes.map((note) => (
                <NoteRow key={note.id} note={note} variant="client-card" />
              ))}
            </div>

            {extraNotes > 0 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed border-border/40">
                <span className="text-xs text-muted-foreground">
                  +{extraNotes} more note{extraNotes !== 1 && 's'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('/operations/notes')}
                >
                  View all notes <ArrowUpRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )

  const visibleMeetings = upcomingMeetings.slice(0, 2)
  const extraMeetings = upcomingMeetings.length - 2

  const RecentTransactionsCard = (
    <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex flex-col gap-2 h-full">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Recent Transactions
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-[11px] text-muted-foreground hover:text-foreground px-2 -mr-2"
          onClick={() => {
            setSearchParams(
              (prev) => {
                prev.set('tab', 'financials')
                prev.set('subtab', 'ledger')
                return prev
              },
              { replace: false },
            )
          }}
        >
          View Ledger <ArrowUpRight className="ml-1 h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col flex-1">
        {isLoadingRecentTransactions ? (
          <div className="space-y-4 mt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2 w-16" />
                  </div>
                </div>
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        ) : recentTransactions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-2">
            <div className="h-10 w-10 border border-dashed rounded-full flex items-center justify-center text-muted-foreground">
              <CircleDollarSign className="h-4 w-4 opacity-50" />
            </div>
            <p className="text-sm text-muted-foreground">
              No recent transactions
            </p>
          </div>
        ) : (
          <div className="space-y-3 mt-1">
            {recentTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-1 group"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                      tx.type === 'INCOME'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-500'
                    }`}
                  >
                    {tx.type === 'INCOME' ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 pr-2">
                    <p className="font-medium text-[13px] group-hover:text-primary transition-colors truncate">
                      {tx.description || tx.category}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {format(new Date(tx.date), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <div
                  className={`text-sm tracking-tight font-medium shrink-0 ${
                    tx.type === 'INCOME'
                      ? 'text-emerald-600 dark:text-emerald-500'
                      : 'text-rose-600 dark:text-rose-500'
                  }`}
                >
                  {tx.type === 'INCOME' ? '+' : '-'}
                  {formatCurrency(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-500">
      {/* COLUMN 1: WORKFLOW HEALTH */}
      <Card className="col-span-1 lg:col-span-1 border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium">Workflow Health</CardTitle>
          <CardDescription>
            Pipeline distribution across statuses
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-between">
          {isLoadingPosts ? (
            <div className="h-[280px] w-full mt-2 flex flex-col items-center justify-center">
              <Skeleton className="h-[200px] w-[200px] rounded-full" />
              <div className="w-full flex justify-between mt-6 px-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-3 w-8" />
              </div>
              <div className="w-full flex justify-between mt-3 px-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-3 w-8" />
              </div>
            </div>
          ) : totalPosts === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground flex-col gap-2">
              <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                <FileText className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p>No active posts</p>
            </div>
          ) : (
            <>
              {/* Scaled-up Donut Chart using Shadcn ChartContainer */}
              <div className="h-[280px] w-full mt-2 relative">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="80%"
                      startAngle={180}
                      endAngle={0}
                      innerRadius={110}
                      outerRadius={150}
                      paddingAngle={2}
                      cornerRadius={6}
                      dataKey="value"
                      nameKey="name"
                      stroke="none"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent hideLabel />}
                    />
                  </PieChart>
                </ChartContainer>
                {/* Center text adjusted for scaled pie chart */}
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                  style={{ top: '35%' }}
                >
                  <span className="text-4xl font-bold">{totalPosts}</span>
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Posts
                  </span>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-col gap-2.5 mt-4 w-full px-1">
                {chartData.map((data, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: data.fill }}
                      />
                      <span className="text-muted-foreground capitalize">
                        {data.name.toLowerCase()}
                      </span>
                    </div>
                    <span className="font-semibold tabular-nums">
                      {data.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Bottleneck Alert */}
              <div className="mt-4 pt-3 border-t border-border/40 px-1">
                {needsRevisionCount > 0 ? (
                  <div className="flex items-center gap-2 border-l-2 border-destructive pl-3">
                    <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    <span className="text-xs text-destructive font-medium">
                      {needsRevisionCount} post{needsRevisionCount !== 1 && 's'}{' '}
                      require immediate revision
                    </span>
                  </div>
                ) : pendingApprovalCount > 0 ? (
                  <div className="flex items-center gap-2 border-l-2 border-amber-500 pl-3">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      {pendingApprovalCount} post
                      {pendingApprovalCount !== 1 && 's'} awaiting approval
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 border-l-2 border-emerald-500 pl-3">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      Pipeline is looking good!
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* REST OF GRID (INTERNAL VS EXTERNAL) */}
      {client?.is_internal ? (
        <>
          {/* COLUMN 2: FINANCIALS (TOP) & QUICK ACTIONS (BOTTOM) */}
          <div className="col-span-1 lg:col-span-1 flex flex-col gap-4">
            <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex-1 flex flex-col gap-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">
                  Agency Financials
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Consolidated — all clients · this month
                </p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-start space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Net Profit
                  </p>
                  <div
                    className={`text-2xl font-bold tracking-tight ${
                      agencyNetProfit >= 0
                        ? 'text-emerald-600 dark:text-emerald-500'
                        : 'text-rose-600 dark:text-rose-500'
                    }`}
                  >
                    {isLoadingAgencyMetrics ? (
                      <Skeleton className="h-8 w-24" />
                    ) : (
                      formatCurrency(agencyNetProfit)
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dashed border-border/40">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-muted-foreground truncate">
                      Total Revenue
                    </span>
                    <span className="text-lg font-bold text-primary">
                      {isLoadingAgencyMetrics ? (
                        <Skeleton className="h-6 w-20" />
                      ) : (
                        formatCurrency(agencyRevenue)
                      )}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-muted-foreground truncate">
                      Total Expenses
                    </span>
                    <span className="text-lg font-bold text-rose-600 dark:text-rose-500">
                      {isLoadingAgencyMetrics ? (
                        <Skeleton className="h-6 w-20" />
                      ) : (
                        formatCurrency(agencyExpenses)
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            {NotesCard}
          </div>

          {/* COLUMN 3: NOTES & REMINDERS */}
          <div className="col-span-1 lg:col-span-1 flex flex-col gap-4">
            <Card className="border-none bg-card/50 shadow-sm ring-1 ring-primary/10 gap-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full justify-start h-12 text-sm shadow-sm"
                  onClick={() => setCreatePostOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Post
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 text-sm bg-background/50 hover:bg-background"
                  onClick={() => setCreateTransactionOpen(true)}
                >
                  <CircleDollarSign className="h-4 w-4 mr-2 text-muted-foreground" />
                  Record Transaction
                </Button>
              </CardContent>
            </Card>
            {RecentTransactionsCard}
          </div>
        </>
      ) : (
        <>
          {/* EXTERNAL CLIENT LAYOUT (Keep Existing Col 2) */}
          <div className="col-span-1 lg:col-span-1 flex flex-col gap-4">
            {/* Financial Standing */}
            <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 gap-2">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-medium">
                  Financials
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Top Row: Net Profit and MRR */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Net Profit */}
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      Net Profit{' '}
                      <span className="text-[10px] font-normal opacity-70">
                        (All-time)
                      </span>
                    </p>
                    <div
                      className={`text-2xl font-bold tracking-tight ${
                        clientNetProfitPositive
                          ? 'text-emerald-600 dark:text-emerald-500'
                          : 'text-rose-600 dark:text-rose-500'
                      }`}
                    >
                      {isLoadingMetrics ? (
                        <Skeleton className="h-8 w-24" />
                      ) : (
                        formatCurrency(clientNetProfit)
                      )}
                    </div>
                  </div>

                  {/* MRR */}
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      MRR{' '}
                      <span className="text-[10px] font-normal opacity-70">
                        (Monthly)
                      </span>
                    </p>
                    <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-500">
                      {isLoadingInvoices ? (
                        <Skeleton className="h-8 w-24" />
                      ) : (
                        formatCurrency(mrr)
                      )}
                    </div>
                  </div>
                </div>

                {/* Second Row: Pending Invoices */}
                <div className="pt-4 border-t border-dashed border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Pending Invoices
                      </p>
                      <span className="text-lg font-semibold tracking-tight text-amber-600 dark:text-amber-500">
                        {isLoadingInvoices ? (
                          <Skeleton className="h-6 w-20" />
                        ) : (
                          formatCurrency(pendingInvoicesTotal)
                        )}
                      </span>
                    </div>

                    {isLoadingInvoices ? (
                      <Skeleton className="h-6 w-20 rounded-full" />
                    ) : (
                      <Badge
                        variant={
                          pendingInvoices.length > 0 ? 'secondary' : 'outline'
                        }
                        className={
                          pendingInvoices.length > 0
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20'
                            : 'text-muted-foreground'
                        }
                      >
                        {pendingInvoices.length} Pending
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Third Row: Additional Metrics */}
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-dashed border-border/50">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground truncate">
                      Total Revenue{' '}
                      <span className="text-[10px] font-normal opacity-70">
                        (Cash)
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {isLoadingMetrics ? (
                        <Skeleton className="h-5 w-16" />
                      ) : (
                        formatCurrency(metrics?.total_revenue || 0)
                      )}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground truncate">
                      Monthly Burn
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {isLoadingMetrics ? (
                        <Skeleton className="h-5 w-16" />
                      ) : (
                        <>
                          {formatCurrency(
                            metrics?.monthly_recurring_costs || 0,
                          )}
                          <span className="text-[10px] text-muted-foreground font-medium ml-0.5">
                            /mo
                          </span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground truncate">
                      Margin{' '}
                      <span className="text-[10px] font-normal opacity-70">
                        (Mo.)
                      </span>
                    </span>
                    <span
                      className={`text-sm font-semibold ${marginColorClass}`}
                    >
                      {isLoadingMetrics ? (
                        <Skeleton className="h-5 w-12" />
                      ) : (
                        `${margin.toFixed(0)}%`
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Meetings */}
            <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex-1 flex flex-col gap-2">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg font-medium">
                  Upcoming Meetings
                </CardTitle>
                <CreateMeetingDialog
                  defaultClientId={client.id}
                  lockClient={true}
                >
                  <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                    <Plus className="h-4 w-4" />
                  </Button>
                </CreateMeetingDialog>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {isLoadingMeetings ? (
                  <div className="space-y-4 py-2">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="flex items-start justify-between">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : visibleMeetings.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-2">
                    <div className="h-10 w-10 border border-dashed rounded-full flex items-center justify-center text-muted-foreground">
                      <CalendarIcon className="h-4 w-4" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      No upcoming meetings
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-0">
                    <div className="space-y-4">
                      {visibleMeetings.map((meeting) => {
                        const meetingDate = new Date(meeting.datetime)
                        let dateLabel = format(meetingDate, 'MMM d, yyyy')
                        let variant = 'outline'

                        if (isToday(meetingDate)) {
                          dateLabel = 'Today'
                          variant = 'default'
                        } else if (isTomorrow(meetingDate)) {
                          dateLabel = 'Tomorrow'
                          variant = 'secondary'
                        } else {
                          const days = differenceInDays(meetingDate, new Date())
                          if (days < 7) {
                            dateLabel = `In ${days} Days`
                            variant = 'secondary'
                          }
                        }

                        // Extract month and day for the square block
                        const monthStr = format(
                          meetingDate,
                          'MMM',
                        ).toUpperCase()
                        const dayStr = format(meetingDate, 'dd')

                        return (
                          <div
                            key={meeting.id}
                            className="hover:bg-background/80 transition-colors border-b border-dashed pb-4 mb-4 last:mb-0 last:pb-0 last:border-0"
                          >
                            <div className="flex items-start gap-4 mb-2">
                              {/* ─── DATE SQUARE BLOCK ─── */}
                              <div className="flex flex-col items-center justify-center w-12 h-12 shrink-0 rounded-lg border border-border bg-muted/40 shadow-sm transition-colors group-hover:bg-muted/60">
                                <span className="text-[10px] font-medium text-muted-foreground leading-none tracking-wider mb-1">
                                  {monthStr}
                                </span>
                                <span className="text-lg font-bold text-foreground leading-none">
                                  {dayStr}
                                </span>
                              </div>

                              {/* ─── CONTENT AREA ─── */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="font-medium text-sm truncate text-foreground">
                                    {meeting.title}
                                  </p>
                                  <Badge
                                    variant={variant}
                                    className="text-[10px] px-1.5 py-0 h-5 shrink-0"
                                  >
                                    {dateLabel}
                                  </Badge>
                                </div>

                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                                  <Clock className="h-3 w-3 shrink-0" />
                                  {format(meetingDate, 'h:mm a')}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 mt-3 border-border/40">
                              <CreateMeetingDialog
                                editMeeting={meeting}
                                defaultClientId={client.id}
                                lockClient={true}
                              >
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 h-7 text-xs"
                                >
                                  Reschedule
                                </Button>
                              </CreateMeetingDialog>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="flex-1 h-7 text-xs"
                                onClick={() => markMeetingDone(meeting.id)}
                                disabled={isCompletingMeeting}
                              >
                                Mark as done
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {extraMeetings > 0 && (
                      <div className="flex items-center justify-between mt-4 pt-3">
                        <span className="text-xs text-muted-foreground">
                          +{extraMeetings} more meeting
                          {extraMeetings !== 1 && 's'}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                          onClick={() => navigate('/operations/meetings')}
                        >
                          View all meetings{' '}
                          <ArrowUpRight className="ml-1 h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* EXTERNAL CLIENT LAYOUT (Keep Existing Col 3) */}
          <div className="col-span-1 lg:col-span-1 flex flex-col gap-4">
            <Card className="col-span-1 lg:col-span-1 border-none bg-card/50 shadow-sm ring-1 ring-primary/10">
              <CardHeader>
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Quick Actions
                </CardTitle>
                <CardDescription>Common tasks for this client</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full justify-start h-12 text-sm shadow-sm"
                  onClick={() => setCreatePostOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Post
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start h-12 text-sm bg-background/50 hover:bg-background"
                  onClick={() => setCreateTransactionOpen(true)}
                >
                  <CircleDollarSign className="h-4 w-4 mr-2 text-muted-foreground" />
                  Record Transaction
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start h-12 text-sm bg-background/50 hover:bg-background"
                  onClick={() => setCreateInvoiceOpen(true)}
                >
                  <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                  Create Invoice
                </Button>

                <CreateMeetingDialog
                  defaultClientId={client.id}
                  lockClient={true}
                >
                  <Button
                    variant="outline"
                    className="w-full justify-start h-12 text-sm bg-background/50 hover:bg-background"
                  >
                    <CalendarIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                    Schedule Meeting
                  </Button>
                </CreateMeetingDialog>
              </CardContent>
            </Card>

            {NotesCard}
          </div>
        </>
      )}

      {/* NEW ROW: SOCIAL MEDIA USAGE & RECENT TRANSACTIONS */}
      {client?.is_internal ? (
        <div className="col-span-1 md:col-span-2 lg:col-span-3">
          <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg font-medium">
                Social Media Usage
              </CardTitle>
              <CardDescription>
                Post distribution across platforms
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPosts ? (
                <div className="h-[250px] w-full flex flex-col gap-6 py-4 px-2">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-6 w-24 shrink-0" />
                    <Skeleton className="h-4 w-[80%]" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-6 w-24 shrink-0" />
                    <Skeleton className="h-4 w-[60%]" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-6 w-24 shrink-0" />
                    <Skeleton className="h-4 w-[70%]" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-6 w-24 shrink-0" />
                    <Skeleton className="h-4 w-[40%]" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-6 w-24 shrink-0" />
                    <Skeleton className="h-4 w-[90%]" />
                  </div>
                </div>
              ) : (
                <ChartContainer
                  config={platformChartConfig}
                  className="h-[250px] w-full"
                >
                  <BarChart
                    data={platformData}
                    layout="vertical"
                    margin={{ top: 0, right: 30, bottom: 0, left: 10 }}
                  >
                    <YAxis
                      dataKey="platform"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      width={40}
                      tick={<CustomPlatformTick />}
                    />
                    <XAxis dataKey="posts" type="number" hide />
                    <ChartTooltip
                      cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                      content={<ChartTooltipContent hideIndicator />}
                    />
                    <Bar dataKey="posts" radius={[0, 4, 4, 0]} barSize={32}>
                      <LabelList
                        dataKey="posts"
                        position="right"
                        className="fill-foreground font-medium text-xs"
                      />
                      {platformData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <div className="col-span-1 lg:col-span-2">
            <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 h-full flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg font-medium">
                  Social Media Usage
                </CardTitle>
                <CardDescription>
                  Post distribution across platforms
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                {isLoadingPosts ? (
                  <div className="h-[250px] w-full flex flex-col gap-6 py-4 px-2">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-6 w-24 shrink-0" />
                      <Skeleton className="h-4 w-[80%]" />
                    </div>
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-6 w-24 shrink-0" />
                      <Skeleton className="h-4 w-[60%]" />
                    </div>
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-6 w-24 shrink-0" />
                      <Skeleton className="h-4 w-[70%]" />
                    </div>
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-6 w-24 shrink-0" />
                      <Skeleton className="h-4 w-[40%]" />
                    </div>
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-6 w-24 shrink-0" />
                      <Skeleton className="h-4 w-[90%]" />
                    </div>
                  </div>
                ) : (
                  <ChartContainer
                    config={platformChartConfig}
                    className="h-[250px] w-full"
                  >
                    <BarChart
                      data={platformData}
                      layout="vertical"
                      margin={{ top: 0, right: 30, bottom: 0, left: 10 }}
                    >
                      <YAxis
                        dataKey="platform"
                        type="category"
                        tickLine={false}
                        axisLine={false}
                        width={40}
                        tick={<CustomPlatformTick />}
                      />
                      <XAxis dataKey="posts" type="number" hide />
                      <ChartTooltip
                        cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                        content={<ChartTooltipContent hideIndicator />}
                      />
                      <Bar dataKey="posts" radius={[0, 4, 4, 0]} barSize={32}>
                        <LabelList
                          dataKey="posts"
                          position="right"
                          className="fill-foreground font-medium text-xs"
                        />
                        {platformData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>
          <div className="col-span-1 lg:col-span-1">
            {RecentTransactionsCard}
          </div>
        </>
      )}

      {/* Hidden Dialogs that are triggered by state */}
      <CreateDraftPost
        clientId={client.id}
        open={createPostOpen}
        onOpenChange={setCreatePostOpen}
      />

      <CreateInvoiceDialog
        preselectedClientId={invoicePrefill?.clientId || client.id}
        open={createInvoiceOpen}
        onOpenChange={(val) => {
          setCreateInvoiceOpen(val)
          if (!val) setInvoicePrefill(null)
        }}
        prefill={invoicePrefill}
        onSuccess={() => {
          // The dialog itself calls onOpenChange(false) which clears prefill
          navigate(`/clients/${client.id}?tab=financials&subtab=invoices`)
        }}
      />

      <AddTransactionDialog
        open={createTransactionOpen}
        onOpenChange={setCreateTransactionOpen}
        defaultClientId={client.id}
        onCreateInvoice={(prefill) => {
          setInvoicePrefill(prefill)
          setCreateInvoiceOpen(true)
        }}
      />
    </div>
  )
}
