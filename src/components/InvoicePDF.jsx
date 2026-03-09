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
  text: '#111827', // Darker almost black for main text
  muted: '#6B7280', // Gray for labels
  border: '#E5E7EB', // Light gray for dividers
  tableHeader: '#F9FAFB',
}

/* ── Styles ── */
const s = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 9,
    color: C.text,
    backgroundColor: C.bg,
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 48,
  },

  /* Dividers */
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginVertical: 16,
  },
  thickDivider: {
    borderBottomWidth: 2,
    borderBottomColor: '#F3F4F6',
    marginVertical: 20,
  },

  /* Header Section */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: C.text,
    letterSpacing: -0.5,
  },
  invoiceNumber: {
    fontSize: 13,
    color: C.muted,
    marginTop: 4,
  },
  logo: {
    height: 24,
    maxWidth: 160,
    objectFit: 'contain',
    marginRight: 8,
    borderRadius: 4
  },
  logoText: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: -0.5,
    color: C.text
  },

  /* Typography Utilities */
  label: {
    fontSize: 8,
    fontWeight: 500,
    color: C.muted,
    marginBottom: 4,
  },
  value: {
    fontSize: 10,
    fontWeight: 500,
    color: C.text,
  },
  valueBold: {
    fontSize: 10,
    fontWeight: 600,
    color: C.text,
  },
  textSm: {
    fontSize: 9,
    color: C.muted,
    lineHeight: 1.5,
  },

  /* Meta Grid (Project, Dates) */
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  /* Address Grid (From, To) */
  addressGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  addressBox: {
    flex: 1,
  },

  /* Table */
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: C.tableHeader,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: 600,
    color: C.text,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tableCell: { fontSize: 10, fontWeight: 500, color: C.text },
  tableCellMuted: { fontSize: 10, color: C.text },

  colDesc: { flex: 2 },
  colQty: { width: 50, textAlign: 'center' },
  colRate: { width: 90, textAlign: 'center' },
  colAmount: { width: 90, textAlign: 'right' },

  /* Totals */
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: C.text,
  },
  totalValue: {
    fontSize: 12,
    fontWeight: 600,
    color: C.text,
  },

  /* Note Box */
  noteBox: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 12,
    marginTop: 16,
    backgroundColor: '#FAFAFA',
  },
  noteText: {
    fontSize: 9,
    color: C.text,
    lineHeight: 1.5,
  },

  /* Bottom Section (Payment & Signature) */
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 40,
  },
  paymentBox: {
    flex: 1,
  },
  /* Branding Footer */
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 7,
    color: C.muted,
  },
})

/* ── Helpers ── */
function fmtCurrency(val) {
  return new Intl.NumberFormat(CURRENCY.LOCALE, {
    style: 'currency',
    currency: CURRENCY.CODE,
    maximumFractionDigits: 0,
  }).format(val || 0)
}

function fmtDate(d) {
  if (!d) return '—'
  try {
    return format(new Date(d), 'MMM dd, yyyy')
  } catch {
    return '—'
  }
}

/* ── PDF Document ── */
export default function InvoicePDF({ invoice, agency = {}, terceroLogoDataUrl = null }) {
  const items = invoice.items || []
  const subtotal = items.reduce(
    (s, item) => s + (item.quantity || 0) * (item.unit_price || 0),
    0,
  )
  const total = invoice.total || subtotal

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ─── Header ─── */}
        <View style={s.header}>
          <View>
            <Text style={s.invoiceTitle}>Invoice</Text>
            <Text style={s.invoiceNumber}>#{invoice.invoice_number}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {(agency.full_whitelabel_enabled || agency.basic_whitelabel_enabled) ? (
              /* Velocity / Quantum — agency branding: horizontal → square → name */
              agency.logo_horizontal_url ? (
                <Image src={agency.logo_horizontal_url} style={{ width: 120, height: 36, objectFit: 'contain', borderRadius: 4 }} />
              ) : agency.logo_url ? (
                <Image src={agency.logo_url} style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4 }} />
              ) : (
                <Text style={s.logoText}>{agency.agency_name || 'Agency'}</Text>
              )
            ) : (
              /* Ignite — TerceroLand logo */
              terceroLogoDataUrl ? (
                <Image src={terceroLogoDataUrl} style={{ width: 90, height: 15, objectFit: 'contain' }} />
              ) : null
            )}
          </View>
        </View>

        <View style={s.divider} />

        {/* ─── Meta Grid (Project & Dates) ─── */}
        <View style={s.metaGrid}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Project</Text>
            <Text style={s.valueBold}>{invoice.project_name || 'Service Retainer'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Category</Text>
            <Text style={s.valueBold}>{invoice.category || 'Other'}</Text>
          </View>
          <View style={{ width: 120 }}>
            <Text style={[s.label, { textAlign: 'right' }]}>Issued Date</Text>
            <Text style={[s.valueBold, { textAlign: 'right' }]}>{fmtDate(invoice.issue_date)}</Text>
          </View>
          <View style={{ width: 120 }}>
            <Text style={[s.label, { textAlign: 'right' }]}>Due Date</Text>
            <Text style={[s.valueBold, { textAlign: 'right' }]}>{fmtDate(invoice.due_date)}</Text>
          </View>
        </View>

        <View style={s.thickDivider} />

        {/* ─── Address Grid (From & To) ─── */}
        <View style={s.addressGrid}>
          <View style={s.addressBox}>
            <Text style={s.label}>From</Text>
            <View style={{ marginTop: 4 }}>
              <Text style={s.valueBold}>{agency.agency_name || 'Agency Name'}</Text>
              {agency.email && <Text style={s.textSm}>{agency.email}</Text>}
              {agency.mobile_number && <Text style={s.textSm}>{agency.mobile_number}</Text>}
            </View>
          </View>

          <View style={[s.addressBox, { alignItems: 'flex-end' }]}>
            <Text style={[s.label, { textAlign: 'right' }]}>To</Text>
            <View style={{ marginTop: 4, alignItems: 'flex-end' }}>
              <Text style={[s.valueBold, { textAlign: 'right' }]}>{invoice.client?.name || 'Client Name'}</Text>
              {invoice.client?.email && <Text style={[s.textSm, { textAlign: 'right' }]}>{invoice.client.email}</Text>}
            </View>
          </View>
        </View>

        <View style={s.thickDivider} />

        {/* ─── Items Table ─── */}
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, s.colDesc]}>Description</Text>
          <Text style={[s.tableHeaderCell, s.colQty]}>Units</Text>
          <Text style={[s.tableHeaderCell, s.colRate]}>Price</Text>
          <Text style={[s.tableHeaderCell, s.colAmount]}>Amount</Text>
        </View>

        {items.map((item, idx) => (
          <View key={idx} style={s.tableRow}>
            <Text style={[s.tableCell, s.colDesc]}>
              {item.description || 'Line item'}
            </Text>
            <Text style={[s.tableCellMuted, s.colQty]}>
              {item.quantity || 1}
            </Text>
            <Text style={[s.tableCellMuted, s.colRate]}>
              {fmtCurrency(item.unit_price)}
            </Text>
            <Text style={[s.tableCell, s.colAmount]}>
              {fmtCurrency((item.quantity || 1) * (item.unit_price || 0))}
            </Text>
          </View>
        ))}

        {/* ─── Total Amount ─── */}
        <View style={s.totalContainer}>
          <Text style={s.totalLabel}>Total Amount</Text>
          <Text style={s.totalValue}>{fmtCurrency(total)}</Text>
        </View>

        {/* ─── Note Box ─── */}
        {invoice.notes && (
          <View style={s.noteBox}>
            <Text style={s.noteText}>
              <Text style={{ fontWeight: 600 }}>Note: </Text>
              {invoice.notes}
            </Text>
          </View>
        )}

        {/* ─── Bottom Section (Payment Terms) ─── */}
        {invoice.payment_terms && (
          <View style={s.bottomSection}>
            <View style={s.paymentBox}>
              <Text style={[s.valueBold, { fontSize: 11, marginBottom: 8 }]}>Payment Terms</Text>
              <Text style={s.textSm}>{invoice.payment_terms}</Text>
            </View>
          </View>
        )}

        {/* ─── Footer: Quantum → none | Velocity → Tercero logo | Ignite → "Tercero 2026" ─── */}
        {agency.full_whitelabel_enabled ? null : agency.basic_whitelabel_enabled ? (
          <View style={[s.footer, { alignItems: 'center' }]}>
            {terceroLogoDataUrl ? (
              <Image src={terceroLogoDataUrl} style={{ width: 52, height: 9, objectFit: 'contain', opacity: 0.4 }} />
            ) : null}
          </View>
        ) : (
          <View style={s.footer}>
            <Text style={s.footerText}>Tercero 2026</Text>
          </View>
        )}

      </Page>
    </Document>
  )
}