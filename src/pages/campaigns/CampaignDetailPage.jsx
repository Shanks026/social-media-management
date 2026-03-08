import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { pdf } from '@react-pdf/renderer'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import {
  ArrowLeft,
  Pencil,
  FileDown,
  FolderOpen,
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
} from 'lucide-react'

import { useHeader } from '@/components/misc/header-context'
import {
  useCampaign,
  useCampaignAnalytics,
  useUpdateCampaign,
  useCampaignInvoices,
} from '@/api/campaigns'
import { useGlobalPosts } from '@/api/useGlobalPosts'
import { useSubscription } from '@/api/useSubscription'
import DraftPostForm from '@/pages/posts/DraftPostForm'
import { LinkPostsToCampaignDialog } from '@/components/campaigns/LinkPostsToCampaignDialog'
import { CampaignDialog } from '@/components/campaigns/CampaignDialog'
import CampaignReportPDF from '@/components/campaigns/CampaignReportPDF'
import StatusBadge from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

const POST_STATUS_STYLES = {
  DRAFT: 'bg-muted text-muted-foreground',
  PENDING:
    'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400',
  REVISIONS:
    'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
  SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  PUBLISHED:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  ARCHIVED: 'bg-muted text-muted-foreground',
}

const PLATFORM_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
]

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
  const [editOpen, setEditOpen] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [createPostOpen, setCreatePostOpen] = useState(false)
  const [linkPostsOpen, setLinkPostsOpen] = useState(false)

  const { data: campaign, isLoading: campaignLoading } = useCampaign(campaignId)
  const { data: analytics, isLoading: analyticsLoading } =
    useCampaignAnalytics(campaignId)
  const { data: postsData, isLoading: postsLoading } = useGlobalPosts({
    campaignId,
  })
  const { data: sub } = useSubscription()
  const { data: invoices = [], isLoading: invoicesLoading } =
    useCampaignInvoices(campaignId)

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

  // On-time rate
  const onTimeRate =
    analytics?.published_posts > 0
      ? `${Math.round((analytics.on_time_posts / analytics.published_posts) * 100)}%`
      : '—'

  // Progress
  const progress =
    analytics?.total_posts > 0
      ? Math.round((analytics.published_posts / analytics.total_posts) * 100)
      : 0

  // Platform chart data
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

  // Budget remaining
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

  return (
    <div className="min-h-full bg-background selection:bg-primary/10">
      <div className="px-8 pt-8 pb-20 space-y-4 max-w-[1440px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3 min-w-0">
            {/* <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => navigate('/campaigns')}
            >
              <ArrowLeft className="size-4" />
            </Button> */}
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
            <Button className="gap-2 h-9" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Edit
            </Button>
          </div>
        </div>

        {/* KPI bar */}
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
            label="Avg Approval"
            value={
              analytics?.avg_approval_days != null
                ? `${analytics.avg_approval_days}d`
                : '—'
            }
            sub="days to approve"
            icon={Clock}
            color="text-amber-500"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* Post list */}
          <Card className="lg:col-span-2 border-none shadow-sm ring-1 ring-border/50 bg-card/50 dark:bg-card/30 flex flex-col h-full gap-4">
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
            <CardContent className="flex-1 p-0 flex flex-col">
              {postsLoading ? (
                <div className="p-4 space-y-3 border-t border-border/60">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : !postsData?.length ? (
                <p className="p-6 text-sm text-muted-foreground text-center">
                  No posts linked to this campaign yet.
                </p>
              ) : (
                <div className="px-4 pb-4 space-y-2">
                  {postsData.map((post) => {
                    const pv = post
                    const mediaUrl = pv.media_urls?.[0]
                    return (
                      <div
                        key={post.id}
                        className="group flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-muted/50 transition-all cursor-pointer border border-transparent hover:border-border/50 shadow-sm hover:shadow-md"
                        onClick={() =>
                          navigate(
                            `/clients/${post.client_id}/posts/${post.id}`,
                          )
                        }
                      >
                        {mediaUrl ? (
                          <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-border/50 bg-muted relative shadow-sm">
                            {mediaUrl.match(/\.(mp4|mov|webm)$/i) ? (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/90">
                                <Play className="size-4 text-white fill-current" />
                              </div>
                            ) : (
                              <img
                                src={mediaUrl}
                                alt=""
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              />
                            )}
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg shrink-0 border border-border/50 bg-muted flex items-center justify-center shadow-sm">
                            <Activity className="size-5 text-muted-foreground/40" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1 ml-1">
                          <p className="text-sm font-semibold truncate text-foreground leading-tight">
                            {pv?.title || 'Untitled'}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {pv?.target_date && (
                              <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1.5 font-medium">
                                <span className="font-bold text-foreground/60 uppercase tracking-tight">
                                  {pv.status === 'PUBLISHED'
                                    ? 'Published'
                                    : 'Target'}
                                </span>
                                <span>
                                  ·{' '}
                                  {format(
                                    parseISO(pv.target_date),
                                    'MMM d, yyyy',
                                  )}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-2.5">
                          <div className="scale-90 origin-right">
                            <StatusBadge status={pv?.status} />
                          </div>
                          <div className="flex items-center -space-x-1.5">
                            {pv?.platforms?.length > 0 ? (
                              pv.platforms.map((p) => (
                                <PlatformIcon key={p} name={p} />
                              ))
                            ) : (
                              <span className="text-[10px] text-muted-foreground/50 ml-1">
                                No platform
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right column: platform chart + budget */}
          <div className="flex flex-col gap-4">
            {/* Progress bar */}
            {(analytics?.total_posts ?? 0) > 0 && (
              <Card className="rounded-xl border-none bg-card/50 shadow-sm ring-1 ring-border/50 dark:bg-card/20 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Overall Progress</span>
                  <span className="text-muted-foreground tabular-nums">
                    {analytics.published_posts} / {analytics.total_posts}{' '}
                    published ({progress}%)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </Card>
            )}

            {/* Platform distribution */}
            {platformData.length > 0 && (
              <Card className="rounded-xl border-none bg-card/50 shadow-sm ring-1 ring-border/50 dark:bg-card/20 p-4">
                <p className="font-medium text-sm mb-3">
                  Platform Distribution
                </p>
                <ChartContainer
                  config={platformChartConfig}
                  className="h-[200px] w-full"
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
              </Card>
            )}

            {/* Budget section */}
            {analytics?.budget != null && (
              <Card className="rounded-2xl border-none bg-card/50 shadow-sm ring-1 ring-border/50 dark:bg-card/20 p-4 space-y-3">
                <p className="font-medium text-sm">Budget</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Budget</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(analytics.budget)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Invoiced</span>
                    <span className="tabular-nums">
                      {formatCurrency(analytics.total_invoiced)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Collected</span>
                    <span className="tabular-nums">
                      {formatCurrency(analytics.total_collected)}
                    </span>
                  </div>
                  <div className="border-t border-border/60 pt-2 flex justify-between text-sm font-medium">
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
                </div>
              </Card>
            )}

            {/* Linked invoices */}
            {invoices.length > 0 && (
              <Card className="rounded-2xl border-none bg-card/50 shadow-sm ring-1 ring-border/50 dark:bg-card/20 overflow-hidden">
                <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
                  <Receipt className="size-4 text-muted-foreground" />
                  <p className="font-medium text-sm">Linked Invoices</p>
                </div>
                <div className="divide-y divide-border/60">
                  {invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="px-4 py-2.5 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/finance?invoice=${inv.id}`)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {inv.invoice_number}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {inv.due_date
                            ? `Due ${format(parseISO(inv.due_date), 'MMM d, yyyy')}`
                            : 'No due date'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-medium tabular-nums">
                          {formatCurrency(inv.total_amount)}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] font-medium px-2 py-0.5 rounded-full',
                            inv.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                              : inv.status === 'Overdue'
                                ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                                : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {inv.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Edit dialog */}
        <CampaignDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          clientId={campaign.client_id}
          initialData={campaign}
        />

        {/* New Post dialog — pre-filled with campaign client + campaign */}
        <DraftPostForm
          open={createPostOpen}
          onOpenChange={setCreatePostOpen}
          clientId={campaign.client_id}
          initialCampaignId={campaignId}
          initialCampaignName={campaign.name}
        />

        {/* Link existing posts dialog */}
        <LinkPostsToCampaignDialog
          open={linkPostsOpen}
          onOpenChange={setLinkPostsOpen}
          campaignId={campaignId}
          clientId={campaign.client_id}
          campaignName={campaign.name}
        />
      </div>
    </div>
  )
}
