import React, { useState } from 'react'
import { Plus, FileText, Calendar as CalendarIcon, AlertCircle, Sparkles, CheckCircle2, Bell, Circle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, LabelList } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { SUPPORTED_PLATFORMS } from '@/lib/platforms'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAllPostsByClient } from '@/api/posts'
import { useInvoices } from '@/api/invoices'
import { fetchUpcomingMeetings, deleteMeeting } from '@/api/meetings'
import { useClientMetrics } from '@/api/clients'
import { useTransactions } from '@/api/transactions'
import { useExpenses } from '@/api/expenses'
import { toast } from 'sonner'
import { calculatePeriodMetrics, formatCurrency } from '@/utils/finance'
import { format, isToday, isTomorrow, differenceInDays, startOfMonth, endOfMonth } from 'date-fns'
import { fetchClientNotes, updateNoteStatus } from '@/api/notes'

// Dialogs
import CreateDraftPost from '../../posts/DraftPostForm'
import { CreateInvoiceDialog } from '../../finance/CreateInvoiceDialog'
import CreateMeetingDialog from '@/components/CreateMeetingDialog'
import CreateNoteDialog from '@/components/CreateNoteDialog'

const platformChartConfig = {
  posts: { label: 'Posts' },
  ...SUPPORTED_PLATFORMS.reduce((acc, p) => {
    acc[p.id] = { label: p.label, color: p.color }
    return acc
  }, {})
}

// 1. Direct Tailwind Colors Configuration for Shadcn Chart
const chartConfig = {
  DRAFT: { label: 'Draft', color: '#3b82f6' }, // Tailwind blue-500
  'PENDING APPROVAL': { label: 'Pending Approval', color: '#f97316' }, // Tailwind orange-500
  'NEEDS REVISION': { label: 'Needs Revision', color: '#ec4899' }, // Tailwind pink-500
  SCHEDULED: { label: 'Scheduled', color: '#a855f7' }, // Tailwind purple-500
  PUBLISHED: { label: 'Published', color: '#10b981' }, // Tailwind emerald-500
}

const ALLOWED_STATUSES = ['DRAFT', 'PENDING APPROVAL', 'NEEDS REVISION', 'SCHEDULED', 'PUBLISHED']

// Custom Y-Axis tick to render platform icons instead of text
const CustomPlatformTick = ({ x, y, payload }) => {
  return (
    <g transform={`translate(${x - 30},${y - 12})`}>
      <image href={`/platformIcons/${payload.value}.png`} height="24" width="24" />
    </g>
  );
};

export default function OverviewTab({ client }) {
  // Dialog States
  const [createPostOpen, setCreatePostOpen] = useState(false)
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false)

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
    SUPPORTED_PLATFORMS.forEach(p => {
      counts[p.id] = 0
    })

    if (posts && posts.length > 0) {
      posts.forEach(post => {
        const plats = Array.isArray(post.platform) ? post.platform : (post.platform ? [post.platform] : [])
        plats.forEach(p => {
          const platformId = p?.toLowerCase()
          if (counts[platformId] !== undefined) {
            counts[platformId] += 1
          }
        })
      })
    }

    return SUPPORTED_PLATFORMS.map(sp => ({
      platform: sp.id, // We use this for the image payload
      label: sp.label,
      posts: counts[sp.id],
      fill: `var(--color-${sp.id})`
    })).sort((a, b) => b.posts - a.posts)
  }, [posts])

  // We fetch all invoices to calculate pending ones and MRR (latest monthly retainer)
  const { data: invoices = [], isLoading: isLoadingInvoices } = useInvoices({
    client_id: client.id,
  })

  const { data: upcomingMeetings = [], isLoading: isLoadingMeetings } = useQuery({
    queryKey: ['upcomingMeetings', client.id],
    queryFn: () => fetchUpcomingMeetings(client.id, 3),
  })

  // Notes
  const { data: notes = [], isLoading: isLoadingNotes } = useQuery({
    queryKey: ['client-notes', client.id],
    queryFn: () => fetchClientNotes(client.id),
  })

  // Toast logic for reminders
  const notifiedNotesRef = React.useRef(new Set())
  React.useEffect(() => {
    if (!notes || notes.length === 0) return

    notes.forEach((note) => {
      if (note.status === 'TODO' && note.due_at) {
        const dueDate = new Date(note.due_at)
        const timeDiffMs = dueDate.getTime() - new Date().getTime()
        const hoursDiff = timeDiffMs / (1000 * 60 * 60)

        // If due within 24 hours and haven't notified yet
        if (hoursDiff > 0 && hoursDiff <= 24 && !notifiedNotesRef.current.has(note.id)) {
          toast.info(`Reminder: "${note.title}" is due in ${Math.round(hoursDiff)} hours!`, {
            icon: <Bell className="h-4 w-4" />,
            duration: 8000,
          })
          notifiedNotesRef.current.add(note.id)
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

  // Financial Metrics
  const { data: metrics, isLoading: isLoadingMetrics } = useClientMetrics(client.id)

  const start = startOfMonth(new Date())
  const end = endOfMonth(new Date())

  const { data: transactions = [] } = useTransactions({
    clientId: client.id,
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd'),
  })

  const { data: expenses = [] } = useExpenses({
    clientId: client.id,
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

  const chartData = ALLOWED_STATUSES.map(name => ({
    name,
    value: postCounts[name],
    fill: chartConfig[name].color
  }))

  const totalPosts = posts.filter(post => {
    const status = post.status?.replace('_', ' ') || 'DRAFT'
    return ALLOWED_STATUSES.includes(status)
  }).length
  
  const needsRevisionCount = postCounts['NEEDS REVISION'] || 0
  const pendingApprovalCount = postCounts['PENDING APPROVAL'] || 0
  
  // 2. Financials
  // "Pending" meaning Sent or Overdue (not Draft, not Paid)
  const pendingInvoices = invoices.filter(inv => inv.status === 'SENT' || inv.status === 'OVERDUE')
  const pendingInvoicesTotal = pendingInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0)
  
  // MRR estimation based on latest 'Monthly Retainer' from both invoices and transactions
  const retainerInvoices = invoices.filter(inv => inv.category === 'Monthly Retainer')
  const retainerTransactions = transactions.filter(t => t.category === 'Monthly Retainer' && t.type === 'INCOME')
  
  // Combine and sort by date descending to find the most recent retainer amount
  const allRetainers = [
    ...retainerInvoices.map(inv => ({ date: new Date(inv.issue_date), amount: Number(inv.total) })),
    ...retainerTransactions.map(t => ({ date: new Date(t.date), amount: Number(t.amount) }))
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
  const { mutate: markMeetingDone, isPending: isCompletingMeeting } = useMutation({
    mutationFn: (meetingId) => deleteMeeting(meetingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upcomingMeetings', client.id] })
      queryClient.invalidateQueries({ queryKey: ['meetings'] })
      queryClient.invalidateQueries({ queryKey: ['todayMeetings'] })
      toast.success('Meeting marked as done')
    },
    onError: (error) => {
      toast.error('Failed to update meeting: ' + error.message)
    },
  })

  // Reusable Notes Card
  const NotesCard = (
    <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex flex-col gap-2 h-full">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          Notes & Reminders
        </CardTitle>
        <CreateNoteDialog clientId={client.id}>
          <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
            <Plus className="h-4 w-4" />
          </Button>
        </CreateNoteDialog>
      </CardHeader>
      <CardContent className="flex flex-col flex-1">
        {isLoadingNotes ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : notes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-2">
            <div className="h-10 w-10 border border-dashed rounded-full flex items-center justify-center text-muted-foreground">
              <FileText className="h-4 w-4 opacity-50" />
            </div>
            <p className="text-sm text-muted-foreground">No pending notes</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
            {notes.map((note) => {
              const overdue = note.due_at && new Date(note.due_at).getTime() < new Date().getTime() && note.status === 'TODO'
              return (
                <div key={note.id} className="flex items-start gap-3 py-1 hover:bg-background/80 transition-colors rounded-md group">
                  <button
                    onClick={() => toggleNoteStatus({ noteId: note.id, newStatus: note.status === 'TODO' ? 'DONE' : 'TODO'})}
                    disabled={isTogglingNote}
                    className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                  >
                    {note.status === 'TODO' ? <Circle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                  </button>
                  <div className={`min-w-0 flex-1 ${note.status !== 'TODO' ? 'opacity-50' : ''}`}>
                    <p className={`font-medium text-sm ${note.status !== 'TODO' ? 'line-through text-muted-foreground' : ''}`}>{note.title}</p>
                    {note.content && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{note.content}</p>
                    )}
                    {note.due_at && (
                      <div className={`flex items-center gap-1 mt-1.5 text-[10px] font-medium ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                        <Bell className="h-3 w-3" />
                        {format(new Date(note.due_at), 'MMM d, h:mm a')}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
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
          <CardDescription>Pipeline distribution across statuses</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-between">
          {isLoadingPosts ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Loading...</div>
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
                      data={chartData}
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
                      {chartData.map((entry, index) => (
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
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: '35%' }}>
                  <span className="text-4xl font-bold">{totalPosts}</span>
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Posts</span>
                </div>
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 mt-2">
                {chartData.map((data, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: data.fill }} />
                      <span className="text-muted-foreground capitalize">{data.name.toLowerCase()}</span>
                    </div>
                    <span className="font-medium">{data.value}</span>
                  </div>
                ))}
              </div>

              {/* Bottleneck Alert */}
              <div className="mt-6 pt-4 border-t border-border/40">
                {needsRevisionCount > 0 ? (
                  <div className="flex items-start gap-2 text-destructive bg-destructive/10 p-3 rounded-lg text-sm font-medium">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{needsRevisionCount} post{needsRevisionCount !== 1 && 's'} require immediate revision</span>
                  </div>
                ) : pendingApprovalCount > 0 ? (
                  <div className="flex items-start gap-2 text-amber-600 dark:text-amber-500 bg-amber-500/10 p-3 rounded-lg text-sm font-medium">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{pendingApprovalCount} post{pendingApprovalCount !== 1 && 's'} pending approval</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-emerald-600 dark:text-emerald-500 bg-emerald-500/10 p-3 rounded-lg text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>Pipeline is looking good!</span>
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

 <Card className="border-none bg-card/50 shadow-sm ring-1 ring-primary/10 gap-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full justify-start h-12 text-sm shadow-sm"
                  onClick={() => setCreatePostOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Post
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex-1 flex flex-col gap-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">Internal Financials</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-start space-y-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Net Profit</p>
                  <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-500">
                    {isLoadingMetrics ? '-' : formatCurrency(metrics?.profit || 0)}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-dashed border-border/40">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-muted-foreground truncate">
                      Total Revenue
                    </span>
                    <span className="text-lg font-bold text-primary">
                      {isLoadingMetrics ? '-' : formatCurrency(metrics?.total_revenue || 0)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-muted-foreground truncate">
                      Total Expenses
                    </span>
                    <span className="text-lg font-bold text-rose-600 dark:text-rose-500">
                      {isLoadingMetrics ? '-' : formatCurrency(metrics?.total_expenses || 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

           
          </div>

          {/* COLUMN 3: NOTES & REMINDERS */}
          <div className="col-span-1 lg:col-span-1 flex flex-col gap-4">
            {NotesCard}
          </div>
        </>
      ) : (
        <>
          {/* EXTERNAL CLIENT LAYOUT (Keep Existing Col 2) */}
          <div className="col-span-1 lg:col-span-1 flex flex-col gap-4">
            {/* Financial Standing */}
            <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 gap-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">Financials</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Monthly Recurring Rate</p>
                  <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-500">
                    {isLoadingInvoices ? '-' : formatCurrency(mrr)}
                  </div>
                </div>
                
                <div className="pt-4 border-t border-dashed border-border/40">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Pending Invoices</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-medium text-amber-600 dark:text-amber-500">
                      {isLoadingInvoices ? '-' : formatCurrency(pendingInvoicesTotal)}
                    </span>
                    <Badge variant={pendingInvoices.length > 0 ? "secondary" : "outline"} className={pendingInvoices.length > 0 ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20" : ""}>
                      {pendingInvoices.length} Pending
                    </Badge>
                  </div>
                </div>

                {/* Additional Metrics */}
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-dashed border-border/40">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-medium text-muted-foreground truncate">
                      Lifetime Value <span className="text-[9px] opacity-70">(Cash)</span>
                    </span>
                    <span className="text-sm font-bold text-primary">
                       {isLoadingMetrics ? '-' : formatCurrency(metrics?.total_revenue || 0)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-medium text-muted-foreground truncate">
                      Monthly Burn
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {isLoadingMetrics ? '-' : formatCurrency(metrics?.monthly_recurring_costs || 0)}
                      <span className="text-[10px] text-primary/70 font-medium ml-0.5">/mo</span>
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-medium text-muted-foreground truncate">
                      Margin <span className="text-[9px] opacity-70">(Mo.)</span>
                    </span>
                    <span className={`text-sm font-bold ${marginColorClass}`}>
                      {margin.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Meetings */}
            <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex-1 flex flex-col gap-2">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg font-medium">Upcoming Meetings</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {isLoadingMeetings ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
                ) : upcomingMeetings.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-2">
                    <div className="h-10 w-10 border border-dashed rounded-full flex items-center justify-center text-muted-foreground">
                      <CalendarIcon className="h-4 w-4" />
                    </div>
                    <p className="text-sm text-muted-foreground">No upcoming meetings</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {upcomingMeetings.map((meeting) => {
                      const meetingDate = new Date(meeting.datetime)
                      let dateLabel = format(meetingDate, 'MMM d, yyyy')
                      let variant = "outline"
                      
                      if (isToday(meetingDate)) {
                        dateLabel = "Today"
                        variant = "default"
                      } else if (isTomorrow(meetingDate)) {
                        dateLabel = "Tomorrow"
                        variant = "secondary"
                      } else {
                        const days = differenceInDays(meetingDate, new Date())
                        if (days < 7) {
                          dateLabel = `In ${days} Days`
                          variant = "secondary"
                        }
                      }

                      return (
                        <div key={meeting.id} className=" hover:bg-background/80 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <div className="min-w-0 pr-4">
                              <p className="font-medium text-sm truncate">{meeting.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{format(meetingDate, 'h:mm a')}</p>
                            </div>
                            <Badge variant={variant} className="text-[10px] px-1.5 py-0 h-5">
                              {dateLabel}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
                            <CreateMeetingDialog editMeeting={meeting}>
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
                  onClick={() => setCreateInvoiceOpen(true)}
                >
                  <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                  Create Invoice
                </Button>

                <CreateMeetingDialog defaultClientId={client.id}>
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

      {/* NEW ROW: SOCIAL MEDIA USAGE (FULL WIDTH - Extends across all 3 columns) */}
      <div className="col-span-1 md:col-span-2 lg:col-span-3">
        <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Social Media Usage</CardTitle>
            <CardDescription>Post distribution across platforms</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={platformChartConfig} className="h-[250px] w-full">
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
                <ChartTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} content={<ChartTooltipContent hideIndicator />} />
                <Bar dataKey="posts" radius={[0, 4, 4, 0]} barSize={32}>
                  <LabelList dataKey="posts" position="right" className="fill-foreground font-medium text-xs" />
                  {platformData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Hidden Dialogs that are triggered by state */}
      <CreateDraftPost
        clientId={client.id}
        open={createPostOpen}
        onOpenChange={setCreatePostOpen}
      />
      
      <CreateInvoiceDialog
        preselectedClientId={client.id}
        open={createInvoiceOpen}
        onOpenChange={setCreateInvoiceOpen}
      />
    </div>
  )
}