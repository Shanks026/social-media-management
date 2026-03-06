import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from '@react-pdf/renderer'
import { format } from 'date-fns'

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
}

const STATUS_LABELS = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending',
  NEEDS_REVISION: 'Revision',
  SCHEDULED: 'Scheduled',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
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
  // Header
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
  periodLabel: {
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
  // Summary row
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: C.tableHeader,
    borderRadius: 6,
    padding: 10,
  },
  summaryLabel: {
    fontSize: 8,
    color: C.muted,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 700,
    color: C.text,
  },
  summaryBreakdown: {
    fontSize: 7.5,
    color: C.muted,
    marginTop: 2,
  },
  // Day section
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    marginTop: 14,
  },
  dayDate: {
    fontSize: 10,
    fontWeight: 600,
    color: C.text,
  },
  dayCount: {
    fontSize: 8,
    color: C.muted,
    marginLeft: 6,
  },
  // Post row
  postRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 8,
  },
  postRowAlt: {
    backgroundColor: C.tableHeader,
  },
  postTitle: {
    flex: 1,
    fontSize: 8.5,
    fontWeight: 500,
    color: C.text,
  },
  postClient: {
    width: 90,
    fontSize: 8,
    color: C.muted,
  },
  postPlatforms: {
    width: 80,
    fontSize: 7.5,
    color: C.muted,
  },
  postStatus: {
    width: 56,
    fontSize: 7.5,
    fontWeight: 500,
    color: C.accent,
    textAlign: 'right',
  },
  tableHeader: {
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

export default function CalendarReportPDF({
  reportData,
  agencyName,
  agencyLogoUrl,
  period,
}) {
  const { days, summary } = reportData

  const statusBreakdown = Object.entries(summary.byStatus)
    .map(([k, v]) => `${STATUS_LABELS[k] || k}: ${v}`)
    .join('  ·  ')

  const platformBreakdown = Object.entries(summary.byPlatform)
    .map(([k, v]) => `${k}: ${v}`)
    .join('  ·  ')

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.periodLabel}>{period}</Text>
            <Text style={s.reportSubtitle}>Content Calendar Report</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {agencyLogoUrl ? (
              <Image src={agencyLogoUrl} style={s.logo} />
            ) : (
              <Text style={s.agencyName}>{agencyName || 'Tercero'}</Text>
            )}
          </View>
        </View>

        <View style={s.divider} />

        {/* Summary */}
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Total Posts</Text>
            <Text style={s.summaryValue}>{summary.total}</Text>
            {statusBreakdown ? (
              <Text style={s.summaryBreakdown}>{statusBreakdown}</Text>
            ) : null}
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Active Days</Text>
            <Text style={s.summaryValue}>{days.length}</Text>
            {platformBreakdown ? (
              <Text style={s.summaryBreakdown}>{platformBreakdown}</Text>
            ) : null}
          </View>
        </View>

        <View style={s.divider} />

        {/* Days & Posts */}
        {days.length === 0 ? (
          <Text style={{ color: C.muted, fontSize: 9, marginTop: 12 }}>
            No posts scheduled for this period.
          </Text>
        ) : (
          days.map((day) => (
            <View key={format(day.date, 'yyyy-MM-dd')} wrap={false}>
              {/* Day header */}
              <View style={s.dayHeader}>
                <Text style={s.dayDate}>{format(day.date, 'EEEE, MMMM d')}</Text>
                <Text style={s.dayCount}>
                  {day.posts.length} post{day.posts.length !== 1 ? 's' : ''}
                </Text>
              </View>

              {/* Column headers */}
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderText, { flex: 1 }]}>Title</Text>
                <Text style={[s.tableHeaderText, { width: 90 }]}>Client</Text>
                <Text style={[s.tableHeaderText, { width: 80 }]}>Platforms</Text>
                <Text style={[s.tableHeaderText, { width: 56, textAlign: 'right' }]}>
                  Status
                </Text>
              </View>

              {/* Post rows */}
              {day.posts.map((post, idx) => (
                <View
                  key={post.version_id || idx}
                  style={[s.postRow, idx % 2 === 1 && s.postRowAlt]}
                >
                  <Text style={s.postTitle} numberOfLines={2}>
                    {post.title || '—'}
                  </Text>
                  <Text style={s.postClient} numberOfLines={1}>
                    {post.client_name || '—'}
                  </Text>
                  <Text style={s.postPlatforms} numberOfLines={1}>
                    {(post.platforms || []).join(', ') || '—'}
                  </Text>
                  <Text style={s.postStatus}>
                    {STATUS_LABELS[post.status] || post.status || '—'}
                  </Text>
                </View>
              ))}
            </View>
          ))
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            Generated {format(new Date(), 'MMM d, yyyy')}
          </Text>
          <Text style={s.footerText}>Tercero · Content Calendar</Text>
        </View>
      </Page>
    </Document>
  )
}
