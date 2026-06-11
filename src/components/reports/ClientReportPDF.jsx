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
import { CURRENCY } from '@/utils/constants'

/* ── Register Inter (full glyph set, incl. ₹ U+20B9) — same fix as InvoicePDF ── */
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/inter-ui@3.19.3/Inter%20(web)/Inter-Regular.woff', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/npm/inter-ui@3.19.3/Inter%20(web)/Inter-Medium.woff', fontWeight: 500 },
    { src: 'https://cdn.jsdelivr.net/npm/inter-ui@3.19.3/Inter%20(web)/Inter-SemiBold.woff', fontWeight: 600 },
    { src: 'https://cdn.jsdelivr.net/npm/inter-ui@3.19.3/Inter%20(web)/Inter-Bold.woff', fontWeight: 700 },
  ],
})

const C = {
  bg: '#FFFFFF',
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  rule: '#111827',
  hair: '#E5E7EB',
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 9,
    color: C.text,
    backgroundColor: C.bg,
    paddingTop: 52,
    paddingBottom: 48,
    paddingHorizontal: 54,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
  },
  kicker: {
    fontSize: 8,
    fontWeight: 600,
    color: C.faint,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  clientName: { fontSize: 24, fontWeight: 700, letterSpacing: -0.6, color: C.text },
  logo: { height: 22, maxWidth: 130, objectFit: 'contain', objectPositionX: 0 },
  agencyName: { fontSize: 12, fontWeight: 700, color: C.text },

  meta: { flexDirection: 'row', gap: 6, marginTop: 14, marginBottom: 30 },
  metaText: { fontSize: 9, color: C.muted },
  metaDot: { fontSize: 9, color: C.faint },

  /* KPI strip — plain numbers, no boxes */
  kpiRow: { flexDirection: 'row', marginBottom: 30 },
  kpiCell: { flex: 1 },
  kpiValue: { fontSize: 20, fontWeight: 700, letterSpacing: -0.5, color: C.text },
  kpiLabel: {
    fontSize: 7.5,
    fontWeight: 500,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 4,
  },

  hr: { borderBottomWidth: 1, borderBottomColor: C.hair, marginBottom: 26 },

  cols: { flexDirection: 'row', gap: 44 },
  col: { flex: 1 },
  sectionLabel: {
    fontSize: 8,
    fontWeight: 600,
    color: C.faint,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 9,
  },
  kvLabel: { fontSize: 9.5, color: C.muted },
  kvValue: { fontSize: 9.5, fontWeight: 600, color: C.text },

  footer: {
    position: 'absolute',
    bottom: 28,
    left: 54,
    right: 54,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.rule,
  },
  footerText: { fontSize: 8, color: C.muted },
})

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

function fmtDate(d) {
  if (!d) return null
  try {
    return format(new Date(d), 'd MMM yyyy')
  } catch {
    return null
  }
}

export default function ClientReportPDF({
  report,
  agencyName,
  agencyLogoUrl,
  agencyEmail,
  agencyWebsite,
  generatedOn,
}) {
  const client = report?.client || {}
  const deliverables = report?.deliverables || { total: 0, by_status: {} }
  const finance = report?.finance || {}
  const campaigns = report?.campaigns || {}
  const proposals = report?.proposals || {}
  const documents = report?.documents || {}
  const pipeline = report?.pipeline || {}

  const statusEntries = Object.entries(deliverables.by_status || {})
  const nextDeliverable = fmtDate(pipeline.next_deliverable_at)

  const metaParts = [
    client.industry || null,
    `Generated ${fmtDate(generatedOn) || ''}`.trim(),
    nextDeliverable ? `Next deliverable ${nextDeliverable}` : null,
  ].filter(Boolean)

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.kicker}>Client Report</Text>
            <Text style={s.clientName}>{client.name || 'Client'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {agencyLogoUrl ? (
              <Image src={agencyLogoUrl} style={s.logo} />
            ) : (
              <Text style={s.agencyName}>{agencyName || 'Agency'}</Text>
            )}
          </View>
        </View>

        {/* Meta */}
        <View style={s.meta}>
          {metaParts.map((part, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 6 }}>
              {i > 0 && <Text style={s.metaDot}>·</Text>}
              <Text style={s.metaText}>{part}</Text>
            </View>
          ))}
        </View>

        {/* KPI strip */}
        <View style={s.kpiRow}>
          <View style={s.kpiCell}>
            <Text style={s.kpiValue}>{deliverables.total ?? 0}</Text>
            <Text style={s.kpiLabel}>Deliverables</Text>
          </View>
          <View style={s.kpiCell}>
            <Text style={s.kpiValue}>{fmtCurrency(finance.billed)}</Text>
            <Text style={s.kpiLabel}>Billed</Text>
          </View>
          <View style={s.kpiCell}>
            <Text style={s.kpiValue}>{fmtCurrency(finance.collected)}</Text>
            <Text style={s.kpiLabel}>Collected</Text>
          </View>
          <View style={s.kpiCell}>
            <Text style={s.kpiValue}>{fmtCurrency(finance.outstanding)}</Text>
            <Text style={s.kpiLabel}>Outstanding</Text>
          </View>
        </View>

        <View style={s.hr} />

        {/* Two columns */}
        <View style={s.cols}>
          <View style={s.col}>
            <Text style={s.sectionLabel}>Deliverables</Text>
            {statusEntries.length > 0 ? (
              statusEntries.map(([status, count]) => (
                <View key={status} style={s.kv}>
                  <Text style={s.kvLabel}>{STATUS_LABELS[status] || status}</Text>
                  <Text style={s.kvValue}>{count}</Text>
                </View>
              ))
            ) : (
              <Text style={s.kvLabel}>No deliverables yet.</Text>
            )}
          </View>

          <View style={s.col}>
            <Text style={s.sectionLabel}>Engagement & Finance</Text>
            <View style={s.kv}>
              <Text style={s.kvLabel}>Campaigns</Text>
              <Text style={s.kvValue}>{campaigns.total ?? 0}</Text>
            </View>
            <View style={s.kv}>
              <Text style={s.kvLabel}>Campaign budget</Text>
              <Text style={s.kvValue}>{fmtCurrency(campaigns.budget_allocated)}</Text>
            </View>
            <View style={s.kv}>
              <Text style={s.kvLabel}>Proposals sent</Text>
              <Text style={s.kvValue}>{proposals.sent ?? 0}</Text>
            </View>
            <View style={s.kv}>
              <Text style={s.kvLabel}>Proposals accepted</Text>
              <Text style={s.kvValue}>{proposals.accepted ?? 0}</Text>
            </View>
            <View style={s.kv}>
              <Text style={s.kvLabel}>Overdue</Text>
              <Text style={s.kvValue}>{fmtCurrency(finance.overdue)}</Text>
            </View>
            <View style={s.kv}>
              <Text style={s.kvLabel}>Documents</Text>
              <Text style={s.kvValue}>{documents.count ?? 0}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{agencyEmail || ''}</Text>
          <Text style={s.footerText}>{agencyWebsite || agencyName || ''}</Text>
        </View>
      </Page>
    </Document>
  )
}
