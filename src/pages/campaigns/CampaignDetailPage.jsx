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
  User,
  FileText,
  CalendarDays,
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchCampaignMeetings, deleteMeeting } from '@/api/meetings'
import { fetchCampaignNotes, updateNoteStatus } from '@/api/notes'
import DraftPostForm from '@/pages/posts/DraftPostForm'
import { LinkPostsToCampaignDialog } from '@/components/campaigns/LinkPostsToCampaignDialog'
import { CampaignDialog } from '@/components/campaigns/CampaignDialog'
import { CampaignUpgradePrompt } from '@/components/campaigns/CampaignUpgradePrompt'
import { CreateInvoiceDialog } from '@/pages/finance/CreateInvoiceDialog'
import CampaignReportPDF from '@/components/campaigns/CampaignReportPDF'
import MeetingRow from '@/components/MeetingRow'
import NoteRow from '@/components/NoteRow'
import CreateMeetingDialog from '@/components/CreateMeetingDialog'
import CreateNoteDialog from '@/components/CreateNoteDialog'
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
    <div className="flex size-5 items-center justify-center rounded-full border border-white dark:border-[#1c1c1f] bg-white dark:bg-zinc-900 shadow-sm overflow-hidden shrink-0">
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
  posts: { label: 'Posts' },
  ...SUPPORTED_PLATFORMS.reduce((acc, p) => {
    acc[p.id] =
      p.id === 'twitter'
        ? { label: p.label, theme: { light: '#000000', dark: '#cbd5e1' } }
        : { label: p.label, color: p.color }
    return acc
  }, {}),
}

const STATUS_STYLES = {
  Active:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  Completed: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  Archived: 'bg-muted text-muted-foreground',
}

function formatDateRange(start, end) {
  if (!start && !end) return 'No dates set'
  const fmt = (d) => format(parseISO(d), 'MMM d, yyyy')
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  if (start) return `From ${fmt(start)}`
  return `Until ${fmt(end)}`
}

function KpiCard({ label, value, sub, icon: Icon, color = 'text-primary' }) {
  return (
    <Card className="rounded-2xl border-none bg-card/50 shadow-sm ring-1 ring-border/50 dark:bg-card/20">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </CardTitle>
        {Icon && <Icon className={cn('h-4 w-4 opacity-70', color)} />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
          {value}
        </div>
        {sub && (
          <p className="text-xs text-muted-foreground mt-1 font-light">{sub}</p>
        )}
      </CardContent>
    </Card>
  )
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
  const [editingMeeting, setEditingMeeting] = useState(null)

  const { data: campaign, isLoading: campaignLoading } = useCampaign(campaignId)
  const { data: analytics, isLoading: analyticsLoading } =
    useCampaignAnalytics(campaignId)
  const { data: postsData, isLoading: postsLoading } = useGlobalPosts({
    campaignId,
  })
  const { data: sub } = useSubscription()
  const { data: invoices = [], isLoading: invoicesLoading } =
    useCampaignInvoices(campaignId)
  const regenerateToken = useRegenerateCampaignReviewToken()
  const markReviewSent = useMarkReviewSent()

  const { data: campaignMeetings = [], isLoading: meetingsLoading } = useQuery({
    queryKey: ['campaign-meetings', campaignId],
    queryFn: () => fetchCampaignMeetings(campaignId),
    enabled: !!campaignId,
  })

  const { data: campaignNotes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['campaign-notes', campaignId],
    queryFn: () => fetchCampaignNotes(campaignId),
    enabled: !!campaignId,
  })

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

  const { mutate: toggleNoteStatus } = useMutation({
    mutationFn: ({ noteId, newStatus }) => updateNoteStatus(noteId, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['campaign-notes', campaignId],
      })
    },
    onError: (error) => {
      toast.error('Failed to update note: ' + error.message)
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

    return SUPPORTED_PLATFORMS.filter((sp) => counts[sp.id] > 0)
      .map((sp) => ({
        platform: sp.id,
        label: sp.label,
        posts: counts[sp.id],
        fill: `var(--color-${sp.id})`,
      }))
      .sort((a, b) => b.posts - a.posts)
  }, [analytics?.platform_distribution])

  const remaining =
    analytics?.budget != null
      ? analytics.budget - analytics.total_invoiced
      : null

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(val ?? 0)

  if (!sub && !isLoading) return null
  if (sub && !sub.campaigns) {
    return (
      <div className="p-6 text-center">
        <CampaignUpgradePrompt />
      </div>
    )
  }

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
      <div className="px-8 pt-8 pb-20 space-y-8 max-w-[1440px] mx-auto animate-pulse">
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

  const visibleMeetings = campaignMeetings.slice(0, 5)
  const extraMeetings = campaignMeetings.length - 5
  const visibleNotes = campaignNotes
    .filter((n) => n.status !== 'ARCHIVED')
    .slice(0, 5)
  const extraNotes =
    campaignNotes.filter((n) => n.status !== 'ARCHIVED').length - 5

  return (
    <div className="min-h-full bg-background selection:bg-primary/10">
      <div className="px-8 pt-8 pb-20 space-y-4 max-w-[1440px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-medium tracking-normal text-foreground truncate">
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
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground font-light flex-wrap">
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
                Share Review Link
              </Button>
            )}
            <Button className="gap-2 h-9" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Edit
            </Button>
          </div>
        </div>

        {/* KPI bar — always visible */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Posts"
            value={analytics?.total_posts ?? 0}
            icon={Activity}
          />
          <KpiCard
            label="Published"
            value={analytics?.published_posts ?? 0}
            icon={CheckCircle2}
            color="text-emerald-500"
          />
          <KpiCard
            label="On-Time Rate"
            value={onTimeRate}
            sub="of published posts"
            icon={Timer}
            color="text-blue-500"
          />
          <KpiCard
            label="Progress"
            value={`${progress}%`}
            sub={`${analytics?.published_posts ?? 0} of ${analytics?.total_posts ?? 0} published`}
            icon={Clock}
            color="text-amber-500"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="pt-2">
          <TabsList className="h-10 mb-4">
            <TabsTrigger value="posts" className="gap-1.5 text-sm px-5">
              <Activity className="size-3.5" />
              Posts
            </TabsTrigger>
            <TabsTrigger value="finance" className="gap-1.5 text-sm px-5">
              <Receipt className="size-3.5" />
              Finance
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5 text-sm px-5">
              <CalendarDays className="size-3.5" />
              Activity
            </TabsTrigger>
          </TabsList>

          {/* ── Posts tab ── */}
          <TabsContent value="posts" className="mt-0">
            <div className="grid grid-cols-1 gap-4">
              {/* Post list */}
              <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 dark:bg-card/30 flex flex-col h-full gap-4">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 shrink-0">
                  <div>
                    <CardTitle className="text-lg font-medium">Posts</CardTitle>
                    <CardDescription>
                      Manage and track campaign posts
                    </CardDescription>
                  </div>
                  {campaign?.status === 'Active' && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5"
                        onClick={() => setLinkPostsOpen(true)}
                      >
                        <Link2 className="size-3.5" />
                        Link Posts
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 gap-1.5"
                        onClick={() => setCreatePostOpen(true)}
                      >
                        <Plus className="size-3.5" />
                        New Post
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
                      <p className="text-sm text-muted-foreground">
                        No posts linked yet
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        Use Link Posts or New Post to get started
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
                                  <Activity className="size-5 text-muted-foreground/40" />
                                </div>
                              )}

                              <div className="min-w-0 flex-1">
                                <p className="text-base font-medium truncate text-foreground leading-tight">
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
            </div>
          </TabsContent>

          {/* ── Finance tab ── */}
          <TabsContent value="finance" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Budget card */}
              <Card className="rounded-2xl border-none bg-card/50 shadow-sm ring-1 ring-border/50 dark:bg-card/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-medium">Budget</CardTitle>
                  <CardDescription>Campaign spend tracking</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analytics ? (
                    <>
                      <div className="flex justify-between text-sm py-1.5 border-b border-border/40">
                        <span className="text-muted-foreground">
                          Total Budget
                        </span>
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
                                : 'text-emerald-600 dark:text-emerald-400',
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
                                width: `${Math.min(100, (analytics.total_invoiced / analytics.budget) * 100)}%`,
                              }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1.5">
                            {Math.round(
                              (analytics.total_invoiced / analytics.budget) *
                                100,
                            )}
                            % of budget invoiced
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
              <Card className="border-none bg-card/50 shadow-sm ring-1 ring-border/50 dark:bg-card/20 flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 shrink-0">
                  <div>
                    <CardTitle className="text-lg font-medium">
                      Linked Invoices
                    </CardTitle>
                    <CardDescription>
                      {invoices.length} invoice
                      {invoices.length !== 1 ? 's' : ''} linked
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
                          {i < 2 && (
                            <hr className="border-t border-dashed border-border/50 mx-6" />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : invoices.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-16 gap-2">
                      {/* <div className="h-10 w-10 border border-dashed rounded-full flex items-center justify-center text-muted-foreground">
                        <Receipt className="h-4 w-4 opacity-50" />
                      </div> */}
                      <p className="text-sm text-muted-foreground">
                        No invoices linked yet
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        Create one to start tracking campaign spend
                      </p>
                    </div>
                  ) : (
                    <div>
                      {invoices.map((inv, idx) => (
                        <div key={inv.id}>
                          <div
                            className="flex items-center gap-4 px-6 py-3 hover:bg-muted/40 transition-colors cursor-pointer group/row"
                            onClick={() =>
                              navigate(`/finance?invoice=${inv.id}`)
                            }
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
          </TabsContent>

          {/* ── Activity tab ── */}
          <TabsContent value="activity" className="mt-0">
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Notes column */}
                <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex flex-col">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 shrink-0">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-muted-foreground" />
                      <CardTitle className="text-base font-medium">
                        Notes
                      </CardTitle>
                    </div>
                    <CreateNoteDialog
                      clientId={campaign.client_id}
                      lockClient={true}
                      campaignId={campaignId}
                      campaignName={campaign.name}
                    >
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </CreateNoteDialog>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col pt-0">
                    {notesLoading ? (
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
                        <p className="text-sm text-muted-foreground">
                          No notes yet
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          Use the + button to add one
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {visibleNotes.map((note) => (
                          <NoteRow
                            key={note.id}
                            note={note}
                            variant="client-card"
                          />
                        ))}
                        {extraNotes > 0 && (
                          <p className="text-xs text-muted-foreground pt-1">
                            +{extraNotes} more —{' '}
                            <button
                              className="underline underline-offset-2 hover:text-foreground transition-colors"
                              onClick={() => navigate('/operations/notes')}
                            >
                              view all
                            </button>
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Meetings column */}
                <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex flex-col">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 shrink-0">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="size-4 text-muted-foreground" />
                      <CardTitle className="text-base font-medium">
                        Meetings
                      </CardTitle>
                    </div>
                    <CreateMeetingDialog
                      defaultClientId={campaign.client_id}
                      lockClient={true}
                      campaignId={campaignId}
                      campaignName={campaign.name}
                      editMeeting={editingMeeting}
                      onSuccess={() => setEditingMeeting(null)}
                    >
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </CreateMeetingDialog>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col pt-0">
                    {meetingsLoading ? (
                      <div className="space-y-4 py-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ) : visibleMeetings.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center py-10 gap-2">
                        <div className="h-10 w-10 border border-dashed rounded-full flex items-center justify-center text-muted-foreground">
                          <CalendarDays className="h-4 w-4" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          No meetings yet
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          Use the + button to schedule one
                        </p>
                      </div>
                    ) : (
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
                        {extraMeetings > 0 && (
                          <p className="text-xs text-muted-foreground pt-1">
                            +{extraMeetings} more —{' '}
                            <button
                              className="underline underline-offset-2 hover:text-foreground transition-colors"
                              onClick={() => navigate('/operations/meetings')}
                            >
                              view all
                            </button>
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Platform distribution — full row below */}
              <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50">
                <CardHeader className="pb-3 shrink-0">
                  <CardTitle className="text-base font-medium">
                    Platform Distribution
                  </CardTitle>
                  <CardDescription>Posts across platforms</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {platformData.length === 0 ? (
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
                      className="h-[220px] w-full"
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
              <DialogTitle>Share Review Link</DialogTitle>
              <DialogDescription>
                Send this link to your client so they can review and approve all
                pending posts in one session.
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
                Regenerate link
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
