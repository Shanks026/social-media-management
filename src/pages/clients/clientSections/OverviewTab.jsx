import React, { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Plus,
  FileText,
  Calendar as CalendarIcon,
  AlertCircle,
  CheckCircle2,
  Bell,
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
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LabelList,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { SUPPORTED_PLATFORMS } from '@/lib/platforms'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAllPostsByClient } from '@/api/posts'
import { fetchUpcomingMeetings, deleteMeeting } from '@/api/meetings'
import { useTransactions } from '@/api/transactions'
import { toast } from 'sonner'
import { formatCurrency } from '@/utils/finance'
import { format } from 'date-fns'
import { getPublishState } from '@/lib/helper'
import MeetingRow from '@/components/MeetingRow'
import { fetchClientNotes, fetchInternalClientNotes } from '@/api/notes'

import CreateMeetingDialog from '@/components/CreateMeetingDialog'
import CreateNoteDialog from '@/components/CreateNoteDialog'
import NoteRow from '@/components/NoteRow'
import ClientWeekTimeline from './ClientWeekTimeline'

const platformChartConfig = {
  posts: { label: 'Posts' },
  ...SUPPORTED_PLATFORMS.reduce((acc, p) => {
    acc[p.id] =
      p.id === 'twitter'
        ? { label: p.label, theme: { light: '#000000', dark: '#cbd5e1' } }
        : { label: p.label, color: p.color }
    return acc
  }, {}),
}

// Chart config — keyed by display name, matching post_status enum
const chartConfig = {
  'DRAFT':            { label: 'Draft',            color: '#3b82f6' },
  'PENDING APPROVAL': { label: 'Pending Approval',  color: '#f97316' },
  'APPROVED':         { label: 'Approved',           color: '#22c55e' },
  'NEEDS REVISION':   { label: 'Needs Revision',    color: '#ec4899' },
  'SCHEDULED':        { label: 'Scheduled',          color: '#a855f7' },
  'DELIVERED':        { label: 'Delivered',          color: '#14b8a6' },
  'PUBLISHED':        { label: 'Published',          color: '#10b981' },
}

const ALLOWED_STATUSES = [
  'DRAFT',
  'PENDING APPROVAL',
  'APPROVED',
  'NEEDS REVISION',
  'SCHEDULED',
  'DELIVERED',
  'PUBLISHED',
]

// Maps DB enum values → display names (ARCHIVED excluded from chart)
const STATUS_DISPLAY_MAP = {
  DRAFT:            'DRAFT',
  PENDING_APPROVAL: 'PENDING APPROVAL',
  APPROVED:         'APPROVED',
  NEEDS_REVISION:   'NEEDS REVISION',
  SCHEDULED:        'SCHEDULED',
  DELIVERED:        'DELIVERED',
  PUBLISHED:        'PUBLISHED',
}

function normalizeStatus(raw) {
  if (!raw) return 'DRAFT'
  return STATUS_DISPLAY_MAP[raw] ?? null
}

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
  const [activeEngagementTab, setActiveEngagementTab] = useState('meetings')

  const [, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

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

  const { data: upcomingMeetings = [], isLoading: isLoadingMeetings } =
    useQuery({
      queryKey: ['upcomingMeetings', client.id],
      queryFn: () => fetchUpcomingMeetings(client.id, 50),
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
  const {
    data: recentTransactions = [],
    isLoading: isLoadingRecentTransactions,
  } = useTransactions({
    clientId: client.id,
    limit: 3,
  })

  // --- Calculations ---

  // 1. Workflow Health
  const postCounts = ALLOWED_STATUSES.reduce((acc, status) => {
    acc[status] = 0
    return acc
  }, {})

  posts.forEach((post) => {
    const status = normalizeStatus(getPublishState(post))
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
    const status = normalizeStatus(getPublishState(post))
    return ALLOWED_STATUSES.includes(status)
  }).length

  const needsRevisionCount = postCounts['NEEDS REVISION'] || 0
  const pendingApprovalCount = postCounts['PENDING APPROVAL'] || 0

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
  const extraNotes = notes.filter((n) => n.status !== 'ARCHIVED').length - 3

  const visibleMeetings = upcomingMeetings.slice(0, 2)
  const extraMeetings = upcomingMeetings.length - 2

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500">
      {/* ROW 1: 3-COLUMN GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* COLUMN 2: MEETINGS + NOTES TABS (moved first) */}
        <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex flex-col">
          <Tabs
            value={activeEngagementTab}
            onValueChange={setActiveEngagementTab}
            className="flex flex-col flex-1"
          >
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 shrink-0">
              <TabsList className="h-9">
                <TabsTrigger value="meetings" className="gap-1.5 text-xs">
                  <CalendarIcon className="size-3.5" /> Meetings
                </TabsTrigger>
                <TabsTrigger value="notes" className="gap-1.5 text-xs">
                  <FileText className="size-3.5" /> Notes
                </TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-1">
                {activeEngagementTab === 'meetings' ? (
                  <CreateMeetingDialog
                    defaultClientId={client.id}
                    lockClient={true}
                  >
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </CreateMeetingDialog>
                ) : (
                  <CreateNoteDialog clientId={client.id} lockClient={true}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </CreateNoteDialog>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col pt-0">
              {/* Meetings Tab */}
              <TabsContent
                value="meetings"
                className="mt-0 flex-1 flex flex-col"
              >
                {isLoadingMeetings ? (
                  <div className="space-y-4 py-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : visibleMeetings.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-10 gap-2">
                    <div className="h-10 w-10 border border-dashed rounded-full flex items-center justify-center text-muted-foreground">
                      <CalendarIcon className="h-4 w-4" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      No upcoming meetings
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col flex-1">
                    <div className="space-y-3">
                      {visibleMeetings.map((meeting) => (
                        <MeetingRow
                          key={meeting.id}
                          meeting={meeting}
                          markMeetingDone={markMeetingDone}
                          isCompletingMeeting={isCompletingMeeting}
                          variant="client-card"
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-dashed border-border/40">
                      {extraMeetings > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          +{extraMeetings} more meeting{extraMeetings !== 1 && 's'}
                        </span>
                      ) : (
                        <span />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => navigate('/operations/meetings')}
                      >
                        View all <ArrowUpRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Notes Tab */}
              <TabsContent
                value="notes"
                className="mt-0 flex-1 flex flex-col"
              >
                {isLoadingNotes ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
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
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-10 gap-2">
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
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed border-border/40">
                      {extraNotes > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          +{extraNotes} more note{extraNotes !== 1 && 's'}
                        </span>
                      ) : (
                        <span />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => navigate('/operations/notes')}
                      >
                        View all notes <ArrowUpRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        {/* COLUMN 1: WORKFLOW HEALTH (moved to center) */}
        <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex flex-col h-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Workflow Health</CardTitle>
            <CardDescription>
              Pipeline distribution across statuses
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
            {isLoadingPosts ? (
              <div className="h-[240px] w-full mt-2 flex flex-col items-center justify-center">
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
            ) : (
              <>
                {/* Scaled-up Donut Chart using Shadcn ChartContainer */}
                <div className="h-[240px] w-full mt-2 relative">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <PieChart>
                      <Pie
                        data={totalPosts === 0 ? [{ name: 'empty', value: 1 }] : pieChartData}
                        cx="50%"
                        cy="80%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius={110}
                        outerRadius={150}
                        paddingAngle={totalPosts === 0 ? 0 : 2}
                        cornerRadius={6}
                        dataKey="value"
                        nameKey="name"
                        stroke="none"
                      >
                        {totalPosts === 0 ? (
                          <Cell fill="var(--border)" />
                        ) : (
                          pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))
                        )}
                      </Pie>
                      {totalPosts > 0 && (
                        <ChartTooltip
                          cursor={false}
                          content={<ChartTooltipContent hideLabel />}
                        />
                      )}
                    </PieChart>
                  </ChartContainer>
                  {/* Center text */}
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                    style={{ top: '35%' }}
                  >
                    {totalPosts === 0 ? (
                      <>
                        <span className="text-3xl font-bold text-muted-foreground/30">0</span>
                        <span className="text-[11px] mt-1 text-muted-foreground/40 font-medium uppercase tracking-wider">
                          Deliverables
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-3xl font-bold">{totalPosts}</span>
                        <span className="text-[11px] mt-1 text-muted-foreground font-medium uppercase tracking-wider">
                          Deliverables
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-col gap-2.5 mt-4 w-full px-1">
                  {chartData.map((data, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between text-xs ${totalPosts === 0 ? 'opacity-40' : ''}`}
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
                {totalPosts > 0 && (
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
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* COLUMN 3: WEEK TIMELINE (external) or RECENT TRANSACTIONS (internal) */}
        {!client.is_internal ? (
          <ClientWeekTimeline clientId={client.id} />
        ) : (
          <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex flex-col gap-2 h-full">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg font-medium">
                Recent Transactions
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-[11px] text-muted-foreground hover:text-foreground px-2 -mr-2"
                onClick={() => navigate('/finance/ledger')}
              >
                View Ledger <ArrowUpRight className="ml-1 h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col flex-1">
              {isLoadingRecentTransactions ? (
                <div className="space-y-4 mt-2">
                  {[1, 2, 3].map((i) => (
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
                <div className="flex flex-col items-center justify-center text-center py-6 gap-2 flex-1">
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
        )}
      </div>

      {/* ROW 2: SOCIAL MEDIA USAGE (+ RECENT TRANSACTIONS for external) */}
      {!client.is_internal ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: '50% 1fr' }}>
          <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex flex-col">
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
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                  ))}
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

          <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex flex-col gap-2">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg font-medium">
                Recent Transactions
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-[11px] text-muted-foreground hover:text-foreground px-2 -mr-2"
                onClick={() =>
                  setSearchParams(
                    (prev) => {
                      prev.set('tab', 'billing')
                      return prev
                    },
                    { replace: false },
                  )
                }
              >
                View Billing <ArrowUpRight className="ml-1 h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col flex-1">
              {isLoadingRecentTransactions ? (
                <div className="space-y-4 mt-2">
                  {[1, 2, 3].map((i) => (
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
                <div className="flex flex-col items-center justify-center text-center py-6 gap-2 flex-1">
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
        </div>
      ) : (
        <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex flex-col">
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
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
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
      )}
    </div>
  )
}
