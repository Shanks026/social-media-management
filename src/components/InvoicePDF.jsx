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

/* ── Register Inter from Google Fonts ── */
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

/* ── Colour palette ── */
const C = {
  bg: '#FFFFFF',
  text: '#1a1a2e',
  muted: '#64748b',
  accent: '#6366f1',
  accentLight: '#eef2ff',
  border: '#e2e8f0',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
  paidBg: '#ecfdf5',
  sentBg: '#eff6ff',
  overdueBg: '#fef2f2',
  draftBg: '#f8fafc',
}

/* ── Styles ── */
const s = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 9,
    color: C.text,
    backgroundColor: C.bg,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 48,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  logo: { width: 48, height: 48, borderRadius: 8, objectFit: 'cover' },
  agencyName: { fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 2 },
  agencyDetail: { fontSize: 8, color: C.muted },
  invoiceTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: C.accent,
    textAlign: 'right',
    letterSpacing: -0.5,
  },
  invoiceNumber: {
    fontSize: 10,
    color: C.muted,
    textAlign: 'right',
    marginTop: 4,
  },

  /* Status badge */
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 8,
    fontWeight: 600,
    textAlign: 'right',
    alignSelf: 'flex-end',
    marginTop: 6,
  },

  /* Info grid */
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
    gap: 16,
  },
  infoBox: { flex: 1 },
  infoLabel: {
    fontSize: 7,
    fontWeight: 600,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  infoText: { fontSize: 9.5, fontWeight: 500, color: C.text, marginBottom: 2 },
  infoSubtext: { fontSize: 8.5, color: C.muted },

  /* Table */
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: C.accentLight,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 2,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontWeight: 600,
    color: C.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  tableRowAlt: { backgroundColor: '#fafbfc' },
  tableCell: { fontSize: 9, color: C.text },
  tableCellMuted: { fontSize: 9, color: C.muted },

  colDesc: { flex: 1 },
  colQty: { width: 60, textAlign: 'center' },
  colRate: { width: 80, textAlign: 'right' },
  colAmount: { width: 80, textAlign: 'right' },

  /* Totals */
  totalsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  totalsBox: { width: 220 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  totalLabel: { fontSize: 9, color: C.muted },
  totalValue: { fontSize: 9, fontWeight: 500 },
  totalRowGrand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: C.accent,
    borderRadius: 6,
    marginTop: 4,
  },
  totalLabelGrand: { fontSize: 11, fontWeight: 600, color: '#ffffff' },
  totalValueGrand: { fontSize: 11, fontWeight: 700, color: '#ffffff' },

  /* Notes & Payment terms */
  notesSection: {
    marginTop: 28,
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
  },
  sectionTitle: {
    fontSize: 8,
    fontWeight: 600,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  notesText: { fontSize: 9, color: C.muted, lineHeight: 1.5 },

  /* Footer */
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    paddingTop: 12,
  },
  footerText: { fontSize: 7, color: C.muted },
})

/* ── Helpers ── */
function fmtCurrency(val) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(val || 0)
}

function fmtDate(d) {
  if (!d) return '—'
  try {
    return format(new Date(d), 'MMM d, yyyy')
  } catch {
    return '—'
  }
}

function getStatusStyle(status) {
  switch (status) {
    case 'PAID':
      return { backgroundColor: C.paidBg, color: C.success }
    case 'SENT':
      return { backgroundColor: C.sentBg, color: '#2563eb' }
    case 'OVERDUE':
      return { backgroundColor: C.overdueBg, color: C.danger }
    default:
      return { backgroundColor: C.draftBg, color: C.muted }
  }
}

/* ── PDF Document ── */
export default function InvoicePDF({ invoice, agency = {} }) {
  const items = invoice.items || []
  const subtotal = items.reduce(
    (s, item) => s + (item.quantity || 0) * (item.unit_price || 0),
    0,
  )
  const total = invoice.total || subtotal
  const statusStyle = getStatusStyle(invoice.status)

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* ─── Header ─── */}
        <View style={s.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {agency.logo_url && <Image src={agency.logo_url} style={s.logo} />}
            <View>
              <Text style={s.agencyName}>
                {agency.agency_name || 'My Agency'}
              </Text>
              {agency.email && (
                <Text style={s.agencyDetail}>{agency.email}</Text>
              )}
              {agency.mobile_number && (
                <Text style={s.agencyDetail}>{agency.mobile_number}</Text>
              )}
            </View>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.invoiceTitle}>INVOICE</Text>
            <Text style={s.invoiceNumber}>{invoice.invoice_number}</Text>
            <View style={[s.statusBadge, statusStyle]}>
              <Text>{invoice.status}</Text>
            </View>
          </View>
        </View>

        {/* ─── Info Grid ─── */}
        <View style={s.infoGrid}>
          <View style={s.infoBox}>
            <Text style={s.infoLabel}>Bill To</Text>
            <Text style={s.infoText}>{invoice.client?.name || 'Client'}</Text>
            {invoice.client?.contact_email && (
              <Text style={s.infoSubtext}>{invoice.client.contact_email}</Text>
            )}
          </View>

          <View style={s.infoBox}>
            <Text style={s.infoLabel}>Issue Date</Text>
            <Text style={s.infoText}>{fmtDate(invoice.issue_date)}</Text>
          </View>

          <View style={s.infoBox}>
            <Text style={s.infoLabel}>Due Date</Text>
            <Text style={s.infoText}>{fmtDate(invoice.due_date)}</Text>
          </View>

          <View style={s.infoBox}>
            <Text style={s.infoLabel}>Payment Terms</Text>
            <Text style={s.infoText}>
              {invoice.payment_terms || 'Due on receipt'}
            </Text>
          </View>
        </View>

        {/* ─── Items Table ─── */}
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, s.colDesc]}>Description</Text>
          <Text style={[s.tableHeaderCell, s.colQty]}>Qty</Text>
          <Text style={[s.tableHeaderCell, s.colRate]}>Rate</Text>
          <Text style={[s.tableHeaderCell, s.colAmount]}>Amount</Text>
        </View>

        {items.map((item, idx) => (
          <View key={idx} style={[s.tableRow, idx % 2 === 1 && s.tableRowAlt]}>
            <Text style={[s.tableCell, s.colDesc]}>
              {item.description || 'Line item'}
            </Text>
            <Text style={[s.tableCellMuted, s.colQty]}>
              {item.quantity || 0}
            </Text>
            <Text style={[s.tableCellMuted, s.colRate]}>
              {fmtCurrency(item.unit_price)}
            </Text>
            <Text style={[s.tableCell, s.colAmount, { fontWeight: 500 }]}>
              {fmtCurrency((item.quantity || 0) * (item.unit_price || 0))}
            </Text>
          </View>
        ))}

        {/* ─── Totals ─── */}
        <View style={s.totalsContainer}>
          <View style={s.totalsBox}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotal</Text>
              <Text style={s.totalValue}>{fmtCurrency(subtotal)}</Text>
            </View>
            <View style={s.totalRowGrand}>
              <Text style={s.totalLabelGrand}>Total Due</Text>
              <Text style={s.totalValueGrand}>{fmtCurrency(total)}</Text>
            </View>
          </View>
        </View>

        {/* ─── Notes ─── */}
        {invoice.notes && (
          <View style={s.notesSection}>
            <Text style={s.sectionTitle}>Notes</Text>
            <Text style={s.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* ─── Footer ─── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            {agency.agency_name || 'My Agency'} · {invoice.invoice_number}
          </Text>
          <Text style={s.footerText}>Generated on {fmtDate(new Date())}</Text>
        </View>
      </Page>
    </Document>
  )
}
