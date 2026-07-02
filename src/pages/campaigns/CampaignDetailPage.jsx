import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { pdf } from '@react-pdf/renderer'
import { BarChart, Bar, XAxis, YAxis, Cell } from 'recharts'
import { format, parseISO } from 'date-fns'
import {
  Pencil,
  FileDown,
  Calendar,
  Target,
  Activity,
  CheckCircle2,
  Clock,
  Timer,
  Plus,
  Link2,
  Receipt,
  Play,
  Share2,
  Copy,
  Mail,
  RefreshCw,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  User,
  Image,
  FileText,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useHeader } from '@/components/misc/header-context'
import {
  useCampaign,
  useCampaignAnalytics,
  useCampaignInvoices,
  useRegenerateCampaignReviewToken,
  useMarkReviewSent,
} from '@/api/campaigns'
import { useGlobalPosts } from '@/api/useGlobalPosts'
import { useSubscription } from '@/api/useSubscription'
import { usePermissions } from '@/api/usePermissions'
import { useCampaignTransactions } from '@/api/transactions'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchCampaignMeetings, deleteMeeting } from '@/api/meetings'
import { useTasks } from '@/api/tasks'
import { useTeamMembers } from '@/api/team'
import { useAuth } from '@/context/AuthContext'
import { AddTransactionDialog } from '@/pages/finance/AddTransactionDialog'
import DraftPostForm from '@/pages/posts/DraftPostForm'
import { LinkPostsToCampaignDialog } from '@/components/campaigns/LinkPostsToCampaignDialog'
import { CampaignDialog } from '@/components/campaigns/CampaignDialog'
import { CreateInvoiceDialog } from '@/pages/finance/CreateInvoiceDialog'
import CampaignReportPDF from '@/components/campaigns/CampaignReportPDF'
import MeetingRow from '@/components/MeetingRow'
import TaskCard from '@/components/tasks/TaskCard'
import CreateMeetingDialog from '@/components/CreateMeetingDialog'
import CreateTaskDialog from '@/components/tasks/CreateTaskDialog'
import StatusBadge from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel'
import { StatBar, StatCell } from '@/components/ui/stat-bar'
import WorkflowHealth from '@/components/WorkflowHealth'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { SUPPORTED_PLATFORMS } from '@/lib/platforms'
import { getUrgencyStatus } from '@/lib/client-helpers'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'

const PlatformIcon = ({ name }) => {
  const fileName = name === 'google_business' ? 'google_busines' : name
  const imgSrc = `/platformIcons/${fileName}.png`

  return (
    <div className="flex size-5 items-center justify-center rounded-full border border-border bg-background shadow-sm overflow-hidden shrink-0">
      <img
        src={imgSrc}
        alt={name}
        className="size-4 object-contain"
        onError={(e) => (e.target.style.display = 'none')}
      />
    </div>
  )
}

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

const platformChartConfig = {
  posts: { label: 'Deliverables' },
  ...SUPPORTED_PLATFORMS.reduce((acc, p) => {
    acc[p.id] =
      p.id === 'twitter'
        ? { label: p.label, theme: { light: '#000000', dark: '#cbd5e1' } }
        : { label: p.label, color: p.color }
    return acc
  }, {}),
}

const STATUS_STYLES = {
  Active: 'bg-emerald-500/15 text-emerald-700',
  Completed: 'bg-blue-500/15 text-blue-700',
  Archived: 'bg-muted text-muted-foreground',
}

function formatDateRange(start, end) {
  if (!start && !end) return 'No dates set'
  const fmt = (d) => format(parseISO(d), 'MMM d, yyyy')
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  if (start) return `From ${fmt(start)}`
  return `Until ${fmt(end)}`
}


export default function CampaignDetailPage() {
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState('posts')
  const [editOpen, setEditOpen] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [createPostOpen, setCreatePostOpen] = useState(false)
  const [linkPostsOpen, setLinkPostsOpen] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [shareDialogUrl, setShareDialogUrl] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false)
  const [addTransactionOpen, setAddTransactionOpen] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState(null)
  const [notesCarouselApi, setNotesCarouselApi] = useState(null)
  const [meetingsCarouselApi, setMeetingsCarouselApi] = useState(null)

  const { data: campaign, isLoading: campaignLoading } = useCampaign(campaignId)
  const { data: analytics, isLoading: analyticsLoading } =
    useCampaignAnalytics(campaignId)
  const { data: postsData, isLoading: postsLoading } = useGlobalPosts({
    campaignId,
  })
  const { data: sub } = useSubscription()
  const { finance } = usePermissions()
  const isInternalClient = campaign?.clients?.is_internal ?? false

  const { data: invoices = [], isLoading: invoicesLoading } =
    useCampaignInvoices(isInternalClient ? null : campaignId)

  const { data: campaignTransactions = [], isLoading: transactionsLoading } =
    useCampaignTransactions(isInternalClient ? campaignId : null)
  const regenerateToken = useRegenerateCampaignReviewToken()
  const markReviewSent = useMarkReviewSent()

  const { data: campaignMeetings = [], isLoading: meetingsLoading } = useQuery({
    queryKey: ['campaign-meetings', campaignId],
    queryFn: () => fetchCampaignMeetings(campaignId),
    enabled: !!campaignId,
  })

  const { data: campaignNotes = [], isLoading: notesLoading } = useTasks({ campaignId })

  const { user } = useAuth()
  const { data: teamMembers = [] } = useTeamMembers()
  const memberMap = useMemo(() => {
    const map = Object.fromEntries(teamMembers.map((m) => [m.member_user_id, m]))
    if (user && !map[user.id]) {
      map[user.id] = {
        member_user_id: user.id,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        email: user.email,
        avatar_url: user.user_metadata?.avatar_url || null,
      }
    }
    return map
  }, [teamMembers, user])
  const clientMap = useMemo(() =>
    campaign?.clients ? { [String(campaign.clients.id)]: campaign.clients } : {},
  [campaign])

  const { mutate: markMeetingDone, isPending: isCompletingMeeting } =
    useMutation({
      mutationFn: (meetingId) => deleteMeeting(meetingId),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['campaign-meetings', campaignId],
        })
        queryClient.invalidateQueries({ queryKey: ['meetings'] })
        queryClient.invalidateQueries({ queryKey: ['todayMeetings'] })
        toast.success('Meeting marked as done')
      },
      onError: (error) => {
        toast.error('Failed to update meeting: ' + error.message)
      },
    })


  const { setHeader } = useHeader()
  useEffect(() => {
    setHeader({
      title: campaign?.name ?? 'Campaign',
      breadcrumbs: [
        { label: 'Campaigns', href: '/campaigns' },
        { label: campaign?.name ?? '...' },
      ],
    })
  }, [setHeader, campaign?.name])

  const isLoading = campaignLoading || analyticsLoading

  const onTimeRate =
    analytics?.published_posts > 0
      ? `${Math.round((analytics.on_time_posts / analytics.published_posts) * 100)}%`
      : '—'

  const progress =
    analytics?.total_posts > 0
      ? Math.round((analytics.published_posts / analytics.total_posts) * 100)
      : 0

  const platformData = useMemo(() => {
    const counts = {}
    Object.entries(analytics?.platform_distribution ?? {}).forEach(
      ([name, count]) => {
        counts[name.toLowerCase()] = count
      },
    )

    return SUPPORTED_PLATFORMS
      .map((sp) => ({
        platform: sp.id,
        label: sp.label,
        posts: counts[sp.id] ?? 0,
        fill: `var(--color-${sp.id})`,
      }))
      .sort((a, b) => b.posts - a.posts)
  }, [analytics?.platform_distribution])

  const remaining =
    analytics?.budget != null
      ? analytics.budget - analytics.total_collected
      : null

  const totalSpent = campaignTransactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const remainingBudget =
    analytics?.budget != null ? analytics.budget - totalSpent : null

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(val ?? 0)

  if (!sub && !isLoading) return null

  async function handleExportPdf() {
    if (!campaign || !analytics) return
    setExportingPdf(true)
    try {
      const blob = await pdf(
        <CampaignReportPDF
          campaign={campaign}
          analytics={analytics}
          posts={postsData ?? []}
          agencyName={sub?.agency_name ?? 'Tercero'}
          agencyLogoUrl={sub?.logo_url ?? null}
        />,
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${campaign.name.replace(/\s+/g, '-')}-report.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF downloaded')
    } catch {
      toast.error('Failed to generate PDF')
    } finally {
      setExportingPdf(false)
    }
  }

  const hasPendingPosts =
    postsData?.some((p) => p.status === 'PENDING_APPROVAL') ?? false
  const canShare = hasPendingPosts && !!campaign?.review_token

  function handleShareLink() {
    const url = `${window.location.origin}/campaign-review/${campaign.review_token}`
    setShareDialogUrl(url)
    setShareDialogOpen(true)
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareDialogUrl)
      toast.success('Review link copied')
    } catch {
      toast.error('Could not copy — select and copy the link manually')
    }
  }

  async function handleSendEmail() {
    if (!campaign?.clients?.email) return
    setSendingEmail(true)
    try {
      const { error } = await supabase.functions.invoke(
        'send-campaign-review-email',
        {
          body: {
            client_email: campaign.clients.email,
            client_name: campaign.clients.name,
            campaign_name: campaign.name,
            review_url: shareDialogUrl,
          },
        },
      )
      if (error) throw error
      markReviewSent.mutate(campaignId)
      toast.success(`Review link sent to ${campaign.clients.email}`)
      setShareDialogOpen(false)
    } catch {
      toast.error('Failed to send email — please copy the link instead')
    } finally {
      setSendingEmail(false)
    }
  }

  async function handleRegenerateToken() {
    try {
      const result = await regenerateToken.mutateAsync(campaignId)
      const newUrl = `${window.location.origin}/campaign-review/${result.review_token}`
      setShareDialogUrl(newUrl)
      toast.success('Review link regenerated')
    } catch {
      toast.error('Failed to regenerate link')
    }
  }

  if (isLoading) {
    return (
      <div className="px-8 pt-8 pb-20 space-y-8 max-w-[1400px] mx-auto animate-pulse">
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-64 rounded-md" />
            <Skeleton className="h-4 w-80 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (!campaign) {
    return <div className="p-6 text-muted-foreground">Campaign not found.</div>
  }

  return (
    <div className="min-h-full bg-background selection:bg-primary/10">
      <div className="px-8 pt-8 pb-20 space-y-4 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-medium tracking-tight text-foreground truncate bricolage">
                  {campaign.name}
                </h1>
                <span
                  className={cn(
                    'text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border',
                    STATUS_STYLES[campaign.status]
                      ? 'border-transparent'
                      : 'border-border',
                    STATUS_STYLES[campaign.status] ?? STATUS_STYLES.Archived,
                  )}
                >
                  {campaign.status}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground font-normal flex-wrap">
                {campaign.clients?.name && (
                  <span className="flex items-center gap-1.5">
                    {campaign.clients.logo_url ? (
                      <img
                        src={campaign.clients.logo_url}
                        alt={campaign.clients.name}
                        className="size-5 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="size-4 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="size-2.5 text-primary" />
                      </div>
                    )}
                    <span className="truncate max-w-xs font-medium">
                      {campaign.clients.name}
                    </span>
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 opacity-60" />
                  {formatDateRange(campaign.start_date, campaign.end_date)}
                </span>
                {campaign.goal && (
                  <span className="flex items-center gap-1.5">
                    <Target className="size-3.5 opacity-60" />
                    <span className="truncate max-w-xs">{campaign.goal}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="outline"
              className="gap-2 h-9"
              onClick={handleExportPdf}
              disabled={exportingPdf}
            >
              <FileDown className="size-4" />
              {exportingPdf ? 'Exporting…' : 'Export PDF'}
            </Button>
            {canShare && (
              <Button
                variant="outline"
                className="gap-2 h-9"
                onClick={handleShareLink}
              >
                <Share2 className="size-4" />
                Send for Approval
              </Button>
            )}
            <Button className="gap-2 h-9" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Edit
            </Button>
          </div>
        </div>

        {/* KPI bar — always visible */}
        <StatBar>
          <StatCell
            label="Total Deliverables"
            value={analytics?.total_posts ?? 0}
            sub="Across all platforms"
            icon={<Activity className="h-3 w-3 text-primary" />}
          />
          <StatCell
            label="Published"
            value={analytics?.published_posts ?? 0}
            valueClass="text-emerald-600 dark:text-emerald-400"
            sub="Successfully delivered"
            icon={<CheckCircle2 className="h-3 w-3 text-emerald-500" />}
            iconBg="bg-emerald-100 dark:bg-emerald-950"
          />
          <StatCell
            label="On-Time Rate"
            value={onTimeRate}
            sub="Of published deliverables"
            icon={<Timer className="h-3 w-3 text-blue-500" />}
            iconBg="bg-blue-100 dark:bg-blue-950"
          />
          <StatCell
            label="Progress"
            value={`${progress}%`}
            sub={`${analytics?.published_posts ?? 0} of ${analytics?.total_posts ?? 0} published`}
            icon={<Clock className="h-3 w-3 text-amber-500" />}
            iconBg="bg-amber-100 dark:bg-amber-950"
          />
        </StatBar>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="pt-2">
          <div className="mb-4">
            <TabsList className="bg-transparent h-auto w-full justify-start rounded-none p-0 gap-12 border-b border-border/40">
              {[
                { value: 'posts',    label: 'Deliverables', icon: Activity },
                ...(finance ? [{ value: 'finance', label: 'Finance', icon: Receipt }] : []),
                { value: 'activity', label: 'Activity',     icon: CalendarDays },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="
                    relative rounded-none bg-transparent px-0 pb-3 pt-0 text-sm font-medium transition-none
                    shadow-none border-b-2 border-transparent text-muted-foreground
                    flex-none w-fit gap-2
                    data-[state=active]:bg-transparent
                    dark:data-[state=active]:bg-transparent
                    data-[state=active]:text-black
                    dark:data-[state=active]:text-white
                    data-[state=active]:border-black
                    dark:data-[state=active]:border-white
                    data-[state=active]:shadow-none
                    data-[state=active]:border-x-0
                    data-[state=active]:border-t-0
                    focus-visible:ring-0
                  "
                >
                  <tab.icon className="size-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* ── Posts tab ── */}
          <TabsContent value="posts" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
              {/* Post list */}
              <Card className="lg:col-span-3 border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex flex-col h-full gap-4">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 shrink-0">
                  <div>
                    <CardTitle className="text-lg font-medium bricolage">
                      Deliverables
                    </CardTitle>
                    <CardDescription>
                      Manage and track campaign deliverables
                    </CardDescription>
                  </div>
                  {campaign?.status === 'Active' && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs gap-1.5"
                        onClick={() => setLinkPostsOpen(true)}
                      >
                        <Link2 className="size-3.5" />
                        Link existing
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 px-2.5 text-xs gap-1.5"
                        onClick={() => setCreatePostOpen(true)}
                      >
                        <Plus className="size-3.5" />
                        New
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="min-h-[320px] p-0 flex flex-col">
                  {postsLoading ? (
                    <div>
                      {[...Array(3)].map((_, i) => (
                        <div key={i}>
                          <div className="flex items-center gap-4 px-6 py-3">
                            <Skeleton className="w-12 h-12 rounded-lg shrink-0" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-1/2" />
                              <Skeleton className="h-3 w-1/3" />
                            </div>
                            <Skeleton className="h-5 w-20 rounded-full" />
                          </div>
                          {i < 2 && (
                            <hr className="border-t border-dashed border-border/50 mx-6" />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : !postsData?.length ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-16 gap-2">
                      <div className="h-10 w-10 border border-dashed rounded-full flex items-center justify-center text-muted-foreground">
                        <Activity className="h-4 w-4 opacity-50" />
                      </div>
                      <p className="text-base font-normal text-foreground bricolage">
                        No deliverables linked yet
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        Use Link Deliverables or New Deliverable to get started
                      </p>
                    </div>
                  ) : (
                    <div>
                      {postsData.map((post, idx) => {
                        const pv = post
                        const mediaUrl = pv.media_urls?.[0]
                        const isCompleted = ['PUBLISHED', 'ARCHIVED'].includes(
                          pv.status,
                        )
                        const health = !isCompleted
                          ? getUrgencyStatus(pv.target_date)
                          : null
                        return (
                          <div key={post.id}>
                            <div
                              className="group flex items-center gap-4 px-6 py-3 hover:bg-muted/40 transition-colors cursor-pointer"
                              onClick={() =>
                                navigate(
                                  `/clients/${post.client_id}/posts/${post.id}`,
                                )
                              }
                            >
                              {mediaUrl ? (
                                <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-border/50 bg-muted relative">
                                  {mediaUrl.match(/\.(mp4|mov|webm)$/i) ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/90">
                                      <Play className="size-4 text-white fill-current" />
                                    </div>
                                  ) : (
                                    <img
                                      src={mediaUrl}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded-lg shrink-0 border border-border/50 bg-muted flex items-center justify-center">
                                  <Image className="size-5 text-muted-foreground/40" />
                                </div>
                              )}

                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate text-foreground leading-tight">
                                  {pv?.title || 'Untitled'}
                                </p>
                                {pv?.target_date && (
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    {health?.color && (
                                      <div className="relative flex h-2 w-2 items-center justify-center shrink-0">
                                        {health.pulse && (
                                          <span
                                            className={cn(
                                              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                                              health.color,
                                            )}
                                          />
                                        )}
                                        <span
                                          className={cn(
                                            'relative inline-flex h-2 w-2 rounded-full',
                                            health.color,
                                          )}
                                        />
                                      </div>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                      {pv.status === 'PUBLISHED'
                                        ? 'Published'
                                        : 'Target'}
                                      {' · '}
                                      {format(
                                        parseISO(pv.target_date),
                                        'MMM d, yyyy',
                                      )}
                                    </p>
                                  </div>
                                )}
                              </div>

                              <div className="shrink-0 flex flex-col items-end gap-2">
                                <StatusBadge
                                  status={pv?.status}
                                  className="text-sm px-3 py-1.5"
                                />
                                {pv?.platforms?.length > 0 && (
                                  <div className="flex items-center -space-x-2">
                                    {pv.platforms.map((p) => (
                                      <PlatformIcon key={p} name={p} />
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            {idx < postsData.length - 1 && (
                              <hr className="border-t border-dashed border-border/50 mx-6" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Workflow health */}
              <WorkflowHealth
                posts={postsData ?? []}
                isLoading={postsLoading}
                description="Deliverable pipeline for this campaign"
                className="lg:col-span-2 border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex flex-col h-full"
              />
            </div>
          </TabsContent>

          {/* ── Finance tab (hidden for members) ── */}
          {finance && (
          <TabsContent value="finance" className="mt-0">
            {isInternalClient ? (
              /* ── Internal campaign: budget vs expense transactions ── */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Budget card */}
                <Card className="rounded-2xl border-none bg-card/50 shadow-sm ring-1 ring-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-medium bricolage">Budget</CardTitle>
                    <CardDescription>Internal cost tracking</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analytics ? (
                      <>
                        <div className="flex justify-between text-sm py-1.5 border-b border-border/40">
                          <span className="text-muted-foreground">Total Budget</span>
                          {analytics.budget != null ? (
                            <span className="font-semibold tabular-nums">
                              {formatCurrency(analytics.budget)}
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              Uncapped
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between text-sm py-1.5 border-b border-border/40">
                          <span className="text-muted-foreground">Total Spent</span>
                          <span className="tabular-nums font-medium">
                            {formatCurrency(totalSpent)}
                          </span>
                        </div>
                        {analytics.budget != null && (
                          <div className="flex justify-between text-sm pt-1 font-semibold">
                            <span>Remaining</span>
                            <span
                              className={cn(
                                'tabular-nums',
                                remainingBudget != null && remainingBudget < 0
                                  ? 'text-destructive'
                                  : 'text-emerald-600',
                              )}
                            >
                              {formatCurrency(remainingBudget)}
                            </span>
                          </div>
                        )}
                        {analytics.budget != null && analytics.budget > 0 && (
                          <div className="pt-2">
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all',
                                  remainingBudget != null && remainingBudget < 0
                                    ? 'bg-destructive'
                                    : 'bg-primary',
                                )}
                                style={{
                                  width: `${Math.min(100, (totalSpent / analytics.budget) * 100)}%`,
                                }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5">
                              {Math.round((totalSpent / analytics.budget) * 100)}% of budget spent
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="space-y-3">
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-5 w-full" />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Linked transactions */}
                <Card className="border-none bg-card/50 shadow-sm ring-1 ring-border/50 flex flex-col">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 shrink-0">
                    <div>
                      <CardTitle className="text-lg font-medium">Expenses</CardTitle>
                      <CardDescription>
                        {campaignTransactions.filter((t) => t.type === 'EXPENSE').length} transaction
                        {campaignTransactions.filter((t) => t.type === 'EXPENSE').length !== 1 ? 's' : ''} logged
                      </CardDescription>
                    </div>
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setAddTransactionOpen(true)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 -mr-2 text-muted-foreground hover:text-foreground"
                        onClick={() => navigate('/finance/ledger')}
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="min-h-[320px] p-0 flex flex-col">
                    {transactionsLoading ? (
                      <div>
                        {[...Array(3)].map((_, i) => (
                          <div key={i}>
                            <div className="flex items-center gap-4 px-6 py-3">
                              <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-3 w-1/4" />
                              </div>
                              <Skeleton className="h-6 w-20 rounded-full" />
                            </div>
                            {i < 2 && <hr className="border-t border-dashed border-border/50 mx-6" />}
                          </div>
                        ))}
                      </div>
                    ) : campaignTransactions.filter((t) => t.type === 'EXPENSE').length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center py-16 gap-2">
                        <p className="text-sm text-muted-foreground">No expenses logged yet</p>
                        <p className="text-xs text-muted-foreground/70">
                          Add an expense transaction to track internal costs
                        </p>
                      </div>
                    ) : (
                      <div className="px-6 py-2 space-y-1">
                        {campaignTransactions
                          .filter((t) => t.type === 'EXPENSE')
                          .map((tx) => (
                            <div
                              key={tx.id}
                              className="flex items-center justify-between py-1 group"
                            >
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-rose-500/10 text-rose-600 dark:text-rose-500">
                                  <ArrowDownRight className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 pr-2">
                                  <p className="font-medium text-[13px] group-hover:text-primary transition-colors truncate">
                                    {tx.description || tx.category}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {tx.category} · {format(new Date(tx.date), 'MMM d, yyyy')}
                                  </p>
                                </div>
                              </div>
                              <p className="text-sm tracking-tight font-medium shrink-0 text-rose-600 dark:text-rose-500">
                                -{formatCurrency(tx.amount)}
                              </p>
                            </div>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              /* ── External campaign: budget vs invoices ── */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Budget card */}
                <Card className="rounded-2xl border-none bg-card/50 shadow-sm ring-1 ring-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-medium bricolage">Budget</CardTitle>
                    <CardDescription>Campaign spend tracking</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analytics ? (
                      <>
                        <div className="flex justify-between text-sm py-1.5 border-b border-border/40">
                          <span className="text-muted-foreground">Total Budget</span>
                          {analytics.budget != null ? (
                            <span className="font-semibold tabular-nums">
                              {formatCurrency(analytics.budget)}
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              Uncapped
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between text-sm py-1.5 border-b border-border/40">
                          <span className="text-muted-foreground">Invoiced</span>
                          <span className="tabular-nums font-medium">
                            {formatCurrency(analytics.total_invoiced)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm py-1.5 border-b border-border/40">
                          <span className="text-muted-foreground">Collected</span>
                          <span className="tabular-nums font-medium">
                            {formatCurrency(analytics.total_collected)}
                          </span>
                        </div>
                        {analytics.budget != null && (
                          <div className="flex justify-between text-sm pt-1 font-semibold">
                            <span>Remaining</span>
                            <span
                              className={cn(
                                'tabular-nums',
                                remaining != null && remaining < 0
                                  ? 'text-destructive'
                                  : 'text-emerald-600',
                              )}
                            >
                              {formatCurrency(remaining)}
                            </span>
                          </div>
                        )}
                        {analytics.budget != null && (
                          <div className="pt-2">
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all',
                                  remaining != null && remaining < 0
                                    ? 'bg-destructive'
                                    : 'bg-primary',
                                )}
                                style={{
                                  width: `${Math.min(100, (analytics.total_collected / analytics.budget) * 100)}%`,
                                }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5">
                              {Math.round((analytics.total_collected / analytics.budget) * 100)}% of budget collected
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="space-y-3">
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-5 w-full" />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Linked invoices */}
                <Card className="border-none bg-card/50 shadow-sm ring-1 ring-border/50 flex flex-col">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 shrink-0">
                    <div>
                      <CardTitle className="text-lg font-medium bricolage">Linked Invoices</CardTitle>
                      <CardDescription>
                        {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} linked
                      </CardDescription>
                    </div>
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCreateInvoiceOpen(true)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 -mr-2 text-muted-foreground hover:text-foreground"
                        onClick={() => navigate('/finance/invoices')}
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="min-h-[320px] p-0 flex flex-col">
                    {invoicesLoading ? (
                      <div>
                        {[...Array(3)].map((_, i) => (
                          <div key={i}>
                            <div className="flex items-center gap-4 px-6 py-3">
                              <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-3 w-1/4" />
                              </div>
                              <Skeleton className="h-6 w-20 rounded-full" />
                            </div>
                            {i < 2 && <hr className="border-t border-dashed border-border/50 mx-6" />}
                          </div>
                        ))}
                      </div>
                    ) : invoices.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center py-16 gap-2">
                        <p className="text-sm text-muted-foreground">No invoices linked yet</p>
                        <p className="text-xs text-muted-foreground/70">
                          Create one to start tracking campaign revenue
                        </p>
                      </div>
                    ) : (
                      <div>
                        {invoices.map((inv, idx) => (
                          <div key={inv.id}>
                            <div
                              className="flex items-center gap-4 px-6 py-3 hover:bg-muted/40 transition-colors cursor-pointer group/row"
                              onClick={() => navigate('/finance/invoices')}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-base font-medium truncate text-foreground leading-tight">
                                  {inv.invoice_number}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {inv.due_date
                                    ? `Due · ${format(parseISO(inv.due_date), 'MMM d, yyyy')}`
                                    : 'No due date'}
                                </p>
                              </div>
                              <div className="shrink-0 flex items-center gap-3">
                                <div className="flex flex-col items-end gap-1.5">
                                  <StatusBadge
                                    status={inv.status?.toUpperCase()}
                                    className="text-sm px-3 py-1.5"
                                  />
                                  <p className="text-sm font-semibold tabular-nums text-foreground">
                                    {formatCurrency(inv.total)}
                                  </p>
                                </div>
                              </div>
                            </div>
                            {idx < invoices.length - 1 && (
                              <hr className="border-t border-dashed border-border/50 mx-6" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
          )}

          {/* ── Activity tab ── */}
          <TabsContent value="activity" className="mt-0">
            <div className="flex flex-col gap-6">
              {/* Notes section */}
              <Card className="border-none bg-card/50 shadow-sm ring-1 ring-border/50 gap-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-medium bricolage">Tasks</CardTitle>
                    {!notesLoading && (
                      <span className="text-lg text-muted-foreground tabular-nums">
                        {campaignNotes.filter((n) => n.status !== 'ARCHIVED').length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => notesCarouselApi?.scrollPrev()}>
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => notesCarouselApi?.scrollNext()}>
                      <ChevronRight className="size-4" />
                    </Button>
                    <CreateTaskDialog clientId={campaign.client_id} lockClient={true} campaignId={campaignId} campaignName={campaign.name}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </CreateTaskDialog>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => navigate('/operations/tasks')}>
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {notesLoading ? (
                    <div className="flex gap-3">
                      {[1, 2, 3].map((i) => <Skeleton key={i} className="w-80 h-44 rounded-xl shrink-0" />)}
                    </div>
                  ) : campaignNotes.filter((n) => n.status !== 'ARCHIVED').length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-10 gap-2 rounded-xl border border-dashed border-border/50">
                      <div className="h-10 w-10 border border-dashed rounded-full flex items-center justify-center text-muted-foreground">
                        <FileText className="h-4 w-4 opacity-50" />
                      </div>
                      <p className="text-sm text-muted-foreground">No notes yet</p>
                      <p className="text-xs text-muted-foreground/70">Use the + button to add one</p>
                    </div>
                  ) : (
                    <Carousel setApi={setNotesCarouselApi} opts={{ align: 'start', dragFree: true }}>
                      <CarouselContent>
                        {campaignNotes.filter((n) => n.status !== 'ARCHIVED').map((note) => (
                          <CarouselItem key={note.id} className="basis-[340px]">
                            <TaskCard task={note} clientMap={clientMap} memberMap={memberMap} currentUserId={user?.id} />
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                    </Carousel>
                  )}
                </CardContent>
              </Card>

              {/* Meetings section */}
              <Card className="border-none bg-card/50 shadow-sm ring-1 ring-border/50 gap-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-medium bricolage">Meetings</CardTitle>
                    {!meetingsLoading && (
                      <span className="text-lg text-muted-foreground tabular-nums">
                        {campaignMeetings.length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => meetingsCarouselApi?.scrollPrev()}>
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => meetingsCarouselApi?.scrollNext()}>
                      <ChevronRight className="size-4" />
                    </Button>
                    <CreateMeetingDialog defaultClientId={campaign.client_id} lockClient={true} campaignId={campaignId} campaignName={campaign.name} editMeeting={editingMeeting} onSuccess={() => setEditingMeeting(null)}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </CreateMeetingDialog>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => navigate('/operations/meetings')}>
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {meetingsLoading ? (
                    <div className="flex gap-3">
                      {[1, 2, 3].map((i) => <Skeleton key={i} className="w-80 h-44 rounded-xl shrink-0" />)}
                    </div>
                  ) : campaignMeetings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-10 gap-2 rounded-xl border border-dashed border-border/50">
                      <div className="h-10 w-10 border border-dashed rounded-full flex items-center justify-center text-muted-foreground">
                        <CalendarDays className="h-4 w-4" />
                      </div>
                      <p className="text-sm text-muted-foreground">No meetings yet</p>
                      <p className="text-xs text-muted-foreground/70">Use the + button to schedule one</p>
                    </div>
                  ) : (
                    <Carousel setApi={setMeetingsCarouselApi} opts={{ align: 'start', dragFree: true }}>
                      <CarouselContent>
                        {campaignMeetings.map((meeting) => (
                          <CarouselItem key={meeting.id} className="basis-[340px]">
                            <MeetingRow meeting={meeting} markMeetingDone={markMeetingDone} isCompletingMeeting={isCompletingMeeting} variant="client-card" />
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                    </Carousel>
                  )}
                </CardContent>
              </Card>

              {/* Platform distribution — full row below */}
              <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50">
                <CardHeader className="pb-3 shrink-0">
                  <CardTitle className="text-lg font-medium bricolage">
                    Platform Distribution
                  </CardTitle>
                  <CardDescription>Posts across platforms</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {!analytics ? (
                    <div className="flex flex-col items-center justify-center text-center py-10 gap-2">
                      <div className="h-10 w-10 border border-dashed rounded-full flex items-center justify-center text-muted-foreground">
                        <Activity className="h-4 w-4 opacity-50" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        No posts yet
                      </p>
                    </div>
                  ) : (
                    <ChartContainer
                      config={platformChartConfig}
                      className="h-[260px] w-full"
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
                        <Bar
                          dataKey="posts"
                          radius={[0, 4, 4, 0]}
                          barSize={24}
                          label={{
                            position: 'right',
                            fill: 'currentColor',
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
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
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <CampaignDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          clientId={campaign.client_id}
          initialData={campaign}
        />

        <CreateInvoiceDialog
          open={createInvoiceOpen}
          onOpenChange={setCreateInvoiceOpen}
          preselectedClientId={campaign.client_id}
          preselectedCampaignId={campaignId}
        />

        <AddTransactionDialog
          open={addTransactionOpen}
          onOpenChange={setAddTransactionOpen}
          defaultClientId={campaign.client_id}
          defaultCampaignId={campaignId}
        />

        <DraftPostForm
          open={createPostOpen}
          onOpenChange={setCreatePostOpen}
          clientId={campaign.client_id}
          initialCampaignId={campaignId}
          initialCampaignName={campaign.name}
        />

        <LinkPostsToCampaignDialog
          open={linkPostsOpen}
          onOpenChange={setLinkPostsOpen}
          campaignId={campaignId}
          clientId={campaign.client_id}
          campaignName={campaign.name}
        />

        <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Campaign Review Link</DialogTitle>
              <DialogDescription>
                Copy the link below or send it directly via email to your client
                for approval.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Input
                value={shareDialogUrl}
                readOnly
                onClick={(e) => e.target.select()}
                className="font-mono text-xs flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={handleCopyLink}
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-muted-foreground h-7 px-2"
                onClick={handleRegenerateToken}
                disabled={regenerateToken.isPending}
              >
                <RefreshCw
                  className={cn(
                    'size-3',
                    regenerateToken.isPending && 'animate-spin',
                  )}
                />
                Resend link
              </Button>
              {campaign?.last_review_sent_at && (
                <p className="text-xs text-muted-foreground">
                  Last sent{' '}
                  {format(
                    parseISO(campaign.last_review_sent_at),
                    'MMM d, yyyy',
                  )}
                </p>
              )}
            </div>
            {campaign?.clients?.email ? (
              <div className="border-t border-border/60 pt-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {campaign.clients.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {campaign.clients.email}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="gap-2 shrink-0"
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                >
                  <Mail className="size-4" />
                  {sendingEmail ? 'Sending…' : 'Send Email'}
                </Button>
              </div>
            ) : (
              <div className="border-t border-border/60 pt-4 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  No email on file — copy and share the link manually.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs h-7 px-2 shrink-0"
                  onClick={() => {
                    setShareDialogOpen(false)
                    navigate(`/clients/${campaign.client_id}`)
                  }}
                >
                  <ExternalLink className="size-3" />
                  Add email
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
