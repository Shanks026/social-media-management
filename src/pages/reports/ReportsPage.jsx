import { useState, useMemo, useEffect } from 'react'
import { Download, Loader2, Activity, Receipt, TrendingUp, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

import { useHeader } from '@/components/misc/header-context'
import { useSubscription } from '@/api/useSubscription'
import { useClients } from '@/api/clients'
import { useClientReportData } from '@/api/reports'
import { downloadClientReportPDF } from '@/utils/downloadClientReportPDF'
import { CURRENCY } from '@/utils/constants'
import { formatDate } from '@/lib/helper'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ClientAvatar } from '@/components/tasks/ClientAvatar'
import { INDUSTRY_OPTIONS } from '@/lib/industries'
import { StatBar, StatCell } from '@/components/ui/stat-bar'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'

const STATUS_LABELS = {
  DRAFT: 'In Progress',
  PENDING_APPROVAL: 'Awaiting Approval',
  NEEDS_REVISION: 'In Revision',
  APPROVED: 'Approved',
  SCHEDULED: 'Scheduled',
  PUBLISHED: 'Delivered',
  DELIVERED: 'Delivered',
  ARCHIVED: 'Archived',
}

function fmtCurrency(val) {
  return new Intl.NumberFormat(CURRENCY.LOCALE, {
    style: 'currency',
    currency: CURRENCY.CODE,
    maximumFractionDigits: 0,
  }).format(val || 0)
}

export default function ReportsPage() {
  const { setHeader } = useHeader()
  const { data: sub } = useSubscription()
  const { data: clientData } = useClients()
  const clients = useMemo(() => clientData?.realClients || [], [clientData])
  const internalAccount = clientData?.internalAccount || null

  const [clientId, setClientId] = useState('')
  const [generating, setGenerating] = useState(false)
  const { data: report, isFetching } = useClientReportData(clientId)

  useEffect(() => {
    setHeader({
      title: 'Reports',
      breadcrumbs: [
        { label: 'Operations', href: '/operations' },
        { label: 'Reports', href: '/reports' },
      ],
    })
  }, [setHeader])

  const agencyData = useMemo(
    () => ({
      agency_name: sub?.agency_name || '',
      logo_url: sub?.logo_horizontal_url || sub?.logo_url || null,
      email: sub?.email || '',
      website: sub?.agency_website || '',
    }),
    [sub],
  )

  const selectedClient = useMemo(
    () => [internalAccount, ...clients].find((c) => c?.id === clientId) || null,
    [clients, internalAccount, clientId],
  )

  const handleGenerate = async () => {
    if (!report) return
    setGenerating(true)
    try {
      await downloadClientReportPDF(report, agencyData)
      toast.success('Report generated')
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  const statusEntries = Object.entries(report?.deliverables?.by_status || {})

  const kpis = [
    {
      label: 'Deliverables',
      value: report?.deliverables?.total ?? 0,
      icon: <Activity className="h-3 w-3 text-primary" />,
    },
    {
      label: 'Billed',
      value: fmtCurrency(report?.finance?.billed),
      icon: <Receipt className="h-3 w-3 text-blue-500" />,
      iconBg: 'bg-blue-100 dark:bg-blue-950',
    },
    {
      label: 'Collected',
      value: fmtCurrency(report?.finance?.collected),
      icon: <TrendingUp className="h-3 w-3 text-emerald-500" />,
      iconBg: 'bg-emerald-100 dark:bg-emerald-950',
    },
    {
      label: 'Outstanding',
      value: fmtCurrency(report?.finance?.outstanding),
      icon: <AlertCircle className="h-3 w-3 text-amber-500" />,
      iconBg: 'bg-amber-100 dark:bg-amber-950',
    },
  ]

  return (
    <div className="min-h-full bg-background selection:bg-primary/10">
      <div className="px-8 pt-8 pb-20 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-normal tracking-tight text-foreground bricolage">
              Reports
            </h1>
            <p className="text-sm text-muted-foreground font-normal">
              Generate a branded report for any client — deliverables, finance, and engagement.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select a client" />
            </SelectTrigger>
            <SelectContent>
              {internalAccount && (
                <SelectGroup>
                  <SelectLabel>Workspace</SelectLabel>
                  <SelectItem value={internalAccount.id}>
                    <div className="flex items-center gap-2">
                      <ClientAvatar client={internalAccount} size="sm" />
                      <span className="truncate">{internalAccount.name}</span>
                    </div>
                  </SelectItem>
                </SelectGroup>
              )}
              {clients.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Clients</SelectLabel>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <ClientAvatar client={c} size="sm" />
                        <span className="truncate">{c.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>

          <Button
            onClick={handleGenerate}
            disabled={!clientId || isFetching || generating || !report}
            className="gap-2 ml-auto h-9"
          >
            {generating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {generating ? 'Generating…' : 'Generate PDF'}
          </Button>
        </div>

        {/* Body */}
        {!clientId ? (
          <Empty className="py-20 border border-dashed rounded-2xl bg-muted/5">
            <EmptyContent>
              <div className="text-4xl leading-none select-none mb-2">📊</div>
              <EmptyHeader>
                <EmptyTitle className="font-bold text-xl">
                  Select a client
                </EmptyTitle>
                <EmptyDescription className="font-normal">
                  Choose a client to preview their numbers and generate a branded report.
                </EmptyDescription>
              </EmptyHeader>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Client header */}
            <div className="flex items-center gap-4">
              {selectedClient && (
                selectedClient.logo_url ? (
                  <img
                    src={selectedClient.logo_url}
                    alt={selectedClient.name}
                    className="size-12 rounded-lg object-cover ring-1 ring-border shrink-0"
                  />
                ) : (
                  <div className="size-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-muted-foreground">
                      {selectedClient.name?.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )
              )}
              <div className="min-w-0">
                <p className="text-2xl bricolage font-bold text-foreground truncate mb-1">
                  {selectedClient?.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {INDUSTRY_OPTIONS.find((i) => i.value === selectedClient?.industry)?.label || '—'}
                  {report?.pipeline?.next_deliverable_at
                    ? ` · Next deliverable ${formatDate(report.pipeline.next_deliverable_at)}`
                    : <span className="text-muted-foreground/60"> · No upcoming deliverable</span>}
                </p>
              </div>
            </div>

            {/* KPI tiles */}
            <StatBar>
              {kpis.map((kpi) => (
                <StatCell
                  key={kpi.label}
                  label={kpi.label}
                  value={isFetching ? '—' : kpi.value}
                  icon={kpi.icon}
                  iconBg={kpi.iconBg}
                />
              ))}
            </StatBar>

            {/* Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              {/* Deliverables by status */}
              <div className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Deliverables
                </p>
                {statusEntries.length > 0 ? (
                  <div className="space-y-2.5">
                    {statusEntries.map(([status, count]) => (
                      <div
                        key={status}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          {STATUS_LABELS[status] || status}
                        </span>
                        <span className="font-medium tabular-nums">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No deliverables yet.</p>
                )}
              </div>

              {/* Engagement & finance */}
              <div className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Engagement & Finance
                </p>
                <div className="space-y-2.5">
                  {[
                    { label: 'Campaigns', value: report?.campaigns?.total ?? 0 },
                    {
                      label: 'Campaign budget',
                      value: fmtCurrency(report?.campaigns?.budget_allocated),
                    },
                    { label: 'Proposals sent', value: report?.proposals?.sent ?? 0 },
                    {
                      label: 'Proposals accepted',
                      value: report?.proposals?.accepted ?? 0,
                    },
                    { label: 'Overdue', value: fmtCurrency(report?.finance?.overdue) },
                    { label: 'Documents', value: report?.documents?.count ?? 0 },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-medium tabular-nums">
                        {isFetching ? '—' : row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
