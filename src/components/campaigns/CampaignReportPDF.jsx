import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from '@react-pdf/renderer'
import { format, parseISO } from 'date-fns'

Font.register({
  family: 'Inter',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjQ.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hjQ.ttf',
      fontWeight: 500,
    },
    {
      src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYAZ9hjQ.ttf',
      fontWeight: 600,
    },
    {
      src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hjQ.ttf',
      fontWeight: 700,
    },
  ],
})

const C = {
  bg: '#FFFFFF',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  tableHeader: '#F9FAFB',
  accent: '#6366F1',
  emerald: '#059669',
  red: '#DC2626',
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 9,
    color: C.text,
    backgroundColor: C.bg,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 20,
    objectFit: 'contain',
  },
  agencyName: {
    fontSize: 14,
    fontWeight: 700,
    color: C.text,
  },
  campaignName: {
    fontSize: 18,
    fontWeight: 700,
    color: C.text,
    marginBottom: 4,
  },
  reportSubtitle: {
    fontSize: 9,
    color: C.muted,
    fontWeight: 400,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 8,
    color: C.muted,
  },
  metaValue: {
    fontSize: 8,
    color: C.text,
    fontWeight: 500,
  },
  // KPI cards
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: C.tableHeader,
    borderRadius: 6,
    padding: 10,
  },
  kpiLabel: {
    fontSize: 7.5,
    color: C.muted,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 700,
    color: C.text,
  },
  kpiSub: {
    fontSize: 7,
    color: C.muted,
    marginTop: 2,
  },
  // Platform table
  sectionTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: C.text,
    marginBottom: 8,
    marginTop: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 8,
  },
  tableRowAlt: {
    backgroundColor: C.tableHeader,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: C.tableHeader,
    borderRadius: 4,
    marginBottom: 2,
    gap: 8,
  },
  tableHeaderText: {
    fontSize: 7.5,
    fontWeight: 600,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  // Budget
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  budgetLabel: {
    fontSize: 8.5,
    color: C.muted,
  },
  budgetValue: {
    fontSize: 8.5,
    color: C.text,
    fontWeight: 500,
  },
  budgetTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginTop: 2,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 7.5,
    color: C.muted,
  },
})

function formatDateRange(campaign) {
  const { start_date, end_date } = campaign
  if (!start_date && !end_date) return 'No dates set'
  const fmt = (d) => format(parseISO(d), 'MMM d, yyyy')
  if (start_date && end_date) return `${fmt(start_date)} – ${fmt(end_date)}`
  if (start_date) return `From ${fmt(start_date)}`
  return `Until ${fmt(end_date)}`
}

function formatCurrency(val) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(val ?? 0)
}

export default function CampaignReportPDF({
  campaign,
  analytics,
  posts = [],
  agencyName,
  agencyLogoUrl,
}) {
  const platformEntries = Object.entries(analytics?.platform_distribution ?? {})
  const hasBudget = analytics?.budget != null
  const remaining = hasBudget ? analytics.budget - analytics.total_invoiced : null

  const onTimeRate =
    analytics?.published_posts > 0
      ? `${Math.round((analytics.on_time_posts / analytics.published_posts) * 100)}%`
      : '—'

  const progress =
    analytics?.total_posts > 0
      ? Math.round((analytics.published_posts / analytics.total_posts) * 100)
      : 0

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.campaignName}>{campaign.name}</Text>
            <Text style={s.reportSubtitle}>Campaign Report</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {agencyLogoUrl ? (
              <Image src={agencyLogoUrl} style={s.logo} />
            ) : (
              <Text style={s.agencyName}>{agencyName || 'Tercero'}</Text>
            )}
          </View>
        </View>

        {/* Campaign meta */}
        <View style={s.metaRow}>
          <View>
            <Text style={s.metaLabel}>Dates</Text>
            <Text style={s.metaValue}>{formatDateRange(campaign)}</Text>
          </View>
          <View>
            <Text style={s.metaLabel}>Status</Text>
            <Text style={s.metaValue}>{campaign.status}</Text>
          </View>
          {campaign.goal ? (
            <View style={{ flex: 1 }}>
              <Text style={s.metaLabel}>Goal</Text>
              <Text style={s.metaValue}>{campaign.goal}</Text>
            </View>
          ) : null}
        </View>

        <View style={s.divider} />

        {/* KPI bar */}
        <View style={s.kpiRow}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Total Deliverables</Text>
            <Text style={s.kpiValue}>{analytics?.total_posts ?? 0}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Published</Text>
            <Text style={s.kpiValue}>{analytics?.published_posts ?? 0}</Text>
            <Text style={s.kpiSub}>{progress}% of total</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>On-Time Rate</Text>
            <Text style={s.kpiValue}>{onTimeRate}</Text>
            <Text style={s.kpiSub}>of published deliverables</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Avg Approval</Text>
            <Text style={s.kpiValue}>
              {analytics?.avg_approval_days != null
                ? `${analytics.avg_approval_days}d`
                : '—'}
            </Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* Platform breakdown */}
        {platformEntries.length > 0 && (
          <View wrap={false}>
            <Text style={s.sectionTitle}>Platform Distribution</Text>
            <View style={s.tableHeaderRow}>
              <Text style={[s.tableHeaderText, { flex: 1 }]}>Platform</Text>
              <Text style={[s.tableHeaderText, { width: 60, textAlign: 'right' }]}>
                Posts
              </Text>
            </View>
            {platformEntries.map(([platform, count], idx) => (
              <View
                key={platform}
                style={[s.tableRow, idx % 2 === 1 && s.tableRowAlt]}
              >
                <Text style={{ flex: 1, fontSize: 8.5 }}>{platform}</Text>
                <Text style={{ width: 60, textAlign: 'right', fontSize: 8.5 }}>
                  {count}
                </Text>
              </View>
            ))}
            <View style={s.divider} />
          </View>
        )}

        {/* Post list */}
        {posts.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Posts</Text>
            <View style={s.tableHeaderRow}>
              <Text style={[s.tableHeaderText, { flex: 1 }]}>Title</Text>
              <Text style={[s.tableHeaderText, { width: 80 }]}>Platform</Text>
              <Text style={[s.tableHeaderText, { width: 72 }]}>Target Date</Text>
              <Text style={[s.tableHeaderText, { width: 56, textAlign: 'right' }]}>
                Status
              </Text>
            </View>
            {posts.map((post, idx) => {
              const pv = post.post_versions
              return (
                <View
                  key={post.id}
                  style={[s.tableRow, idx % 2 === 1 && s.tableRowAlt]}
                  wrap={false}
                >
                  <Text style={{ flex: 1, fontSize: 8.5 }} numberOfLines={2}>
                    {pv?.title || 'Untitled'}
                  </Text>
                  <Text style={{ width: 80, fontSize: 8, color: C.muted }}>
                    {(pv?.platform ?? []).join(', ') || '—'}
                  </Text>
                  <Text style={{ width: 72, fontSize: 8, color: C.muted }}>
                    {pv?.target_date
                      ? format(parseISO(pv.target_date), 'MMM d, yyyy')
                      : '—'}
                  </Text>
                  <Text
                    style={{
                      width: 56,
                      textAlign: 'right',
                      fontSize: 7.5,
                      fontWeight: 500,
                      color: C.accent,
                    }}
                  >
                    {pv?.status ?? '—'}
                  </Text>
                </View>
              )
            })}
          </View>
        )}

        {/* Budget section */}
        {hasBudget && (
          <View wrap={false} style={{ marginTop: 16 }}>
            <View style={s.divider} />
            <Text style={s.sectionTitle}>Budget Summary</Text>
            <View style={s.budgetRow}>
              <Text style={s.budgetLabel}>Total Budget</Text>
              <Text style={s.budgetValue}>{formatCurrency(analytics.budget)}</Text>
            </View>
            <View style={s.budgetRow}>
              <Text style={s.budgetLabel}>Total Invoiced</Text>
              <Text style={s.budgetValue}>{formatCurrency(analytics.total_invoiced)}</Text>
            </View>
            <View style={s.budgetRow}>
              <Text style={s.budgetLabel}>Total Collected</Text>
              <Text style={s.budgetValue}>{formatCurrency(analytics.total_collected)}</Text>
            </View>
            <View style={s.budgetTotalRow}>
              <Text style={[s.budgetLabel, { fontWeight: 600, color: C.text }]}>
                Remaining
              </Text>
              <Text
                style={[
                  s.budgetValue,
                  { color: remaining != null && remaining < 0 ? C.red : C.emerald },
                ]}
              >
                {formatCurrency(remaining)}
              </Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            Generated {format(new Date(), 'MMM d, yyyy')}
          </Text>
          <Text style={s.footerText}>Tercero · Campaign Report</Text>
        </View>
      </Page>
    </Document>
  )
}
