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

/* ── Register Inter (full glyph set, incl. ₹ U+20B9) ──
   NOTE: The Google Fonts gstatic "latin" subset omits the Indian Rupee glyph,
   so currency rendered blank in the PDF. These inter-ui web fonts ship the
   complete glyph set. */
Font.register({
  family: 'Inter',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/npm/inter-ui@3.19.3/Inter%20(web)/Inter-Regular.woff',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/inter-ui@3.19.3/Inter%20(web)/Inter-Medium.woff',
      fontWeight: 500,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/inter-ui@3.19.3/Inter%20(web)/Inter-SemiBold.woff',
      fontWeight: 600,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/inter-ui@3.19.3/Inter%20(web)/Inter-Bold.woff',
      fontWeight: 700,
    },
  ],
})

/* ── Colour palette ── */
const C = {
  bg: '#FFFFFF',
  text: '#111827',
  muted: '#6B7280',
  rule: '#111827', // header / footer hairline
  dash: '#D1D5DB', // dashed table dividers
  placeholder: '#9CA3AF',
}

/* ── Styles ── */
const s = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 9,
    color: C.text,
    backgroundColor: C.bg,
    paddingTop: 44,
    paddingBottom: 40,
    paddingHorizontal: 48,
    flexDirection: 'column',
  },

  /* Header */
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
  },
  invoiceNo: {
    fontSize: 12,
    fontWeight: 700,
    color: C.text,
  },
  agencyNameTop: {
    fontSize: 12,
    fontWeight: 700,
    color: C.text,
  },

  /* Title */
  title: {
    fontSize: 52,
    fontWeight: 400,
    letterSpacing: -1.5,
    color: C.text,
    marginTop: 22,
    marginBottom: 30,
  },

  /* Meta */
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: 400,
    color: C.muted,
    marginBottom: 6,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: 700,
    color: C.text,
  },
  metaAddress: {
    fontSize: 8.5,
    fontWeight: 400,
    color: C.muted,
    marginTop: 4,
    lineHeight: 1.4,
    maxWidth: 220,
  },
  metaDates: {
    flexDirection: 'row',
    gap: 44,
  },

  /* Table */
  tableHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderStyle: 'dashed',
    borderTopWidth: 1,
    borderTopColor: C.dash,
    borderBottomWidth: 1,
    borderBottomColor: C.dash,
  },
  headCell: {
    fontSize: 10,
    fontWeight: 400,
    color: C.muted,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderStyle: 'dashed',
    borderBottomWidth: 1,
    borderBottomColor: C.dash,
  },
  descCell: { fontSize: 11, fontWeight: 700, color: C.text },
  numCell: { fontSize: 11, fontWeight: 400, color: C.text },

  colDesc: { flex: 1 },
  colUnit: { width: 60, textAlign: 'center' },
  colPrice: { width: 100, textAlign: 'right' },
  colAmount: { width: 110, textAlign: 'right' },

  /* Total */
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 18,
  },
  totalLabel: { fontSize: 13, fontWeight: 600, color: C.text },
  totalValue: { fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: -0.5 },

  /* Notes */
  noteBlock: { marginTop: 22, maxWidth: 320 },
  noteLabel: { fontSize: 9, fontWeight: 600, color: C.text, marginBottom: 4 },
  noteText: { fontSize: 9, color: C.muted, lineHeight: 1.5 },

  /* Spacer pushes the closing block to the page bottom */
  spacer: { flexGrow: 1, minHeight: 40 },

  /* Closing block (agency + signatory) */
  closing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 22,
  },
  agencyBlock: { maxWidth: 260, alignItems: 'flex-start' },
  logoPlaceholder: {
    width: 110,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#D1D5DB',
    marginBottom: 20,
  },
  agencyBlockName: { fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 4 },
  agencyBlockLine: { fontSize: 9.5, fontWeight: 400, color: C.text, lineHeight: 1.45 },

  signBlock: { alignItems: 'center', maxWidth: 240 },
  signImage: { height: 70, maxWidth: 220, objectFit: 'contain', marginBottom: 10 },
  signName: { fontSize: 11, fontWeight: 700, color: C.text },
  signRole: { fontSize: 10, fontWeight: 400, color: C.muted, marginTop: 2 },

  /* Footer */
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: C.rule,
  },
  footerSide: { flex: 1 },
  footerText: { fontSize: 9, fontWeight: 400, color: C.text },
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
    return format(new Date(d), 'd MMMM, yyyy')
  } catch {
    return '—'
  }
}

function addressLines(addr) {
  if (!addr) return []
  return String(addr).split('\n').map((l) => l.trim()).filter(Boolean)
}

/* ── PDF Document ── */
export default function InvoicePDF({ invoice, agency = {}, terceroLogoDataUrl = null }) {
  const items = invoice.items || []
  const subtotal = items.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0),
    0,
  )
  const total = invoice.total || subtotal

  const isWhitelabel =
    agency.full_whitelabel_enabled || agency.basic_whitelabel_enabled
  const agencyName = agency.agency_name || 'Agency'
  const clientAddr = addressLines(invoice.client?.address)
  const agencyAddr = addressLines(agency.agency_address)

  /* Bottom-left logo — same branding condition used elsewhere */
  const renderLogo = () => {
    if (isWhitelabel) {
      if (agency.logo_horizontal_url)
        return <Image src={agency.logo_horizontal_url} style={{ height: 40, maxWidth: 130, objectFit: 'contain', objectPositionX: 0, marginBottom: 20 }} />
      if (agency.logo_url)
        return <Image src={agency.logo_url} style={{ width: 44, height: 44, objectFit: 'contain', objectPositionX: 0, borderRadius: 6, marginBottom: 20 }} />
      return null
    }
    // Ignite — Tercero branding
    if (terceroLogoDataUrl)
      return <Image src={terceroLogoDataUrl} style={{ height: 18, maxWidth: 110, objectFit: 'contain', objectPositionX: 0, marginBottom: 20 }} />
    return <View style={s.logoPlaceholder} />
  }

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ─── Header ─── */}
        <View style={s.topBar}>
          <Text style={s.invoiceNo}>#{invoice.invoice_number}</Text>
          <Text style={s.agencyNameTop}>{agencyName}</Text>
        </View>

        {/* ─── Title ─── */}
        <Text style={s.title}>Invoice</Text>

        {/* ─── Meta ─── */}
        <View style={s.metaRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.metaLabel}>Billed To</Text>
            <Text style={s.metaValue}>{invoice.client?.name || 'Client Name'}</Text>
            {clientAddr.map((line, i) => (
              <Text key={i} style={s.metaAddress}>{line}</Text>
            ))}
          </View>
          <View style={s.metaDates}>
            <View>
              <Text style={s.metaLabel}>Created On</Text>
              <Text style={s.metaValue}>{fmtDate(invoice.issue_date)}</Text>
            </View>
            <View>
              <Text style={s.metaLabel}>Due On</Text>
              <Text style={s.metaValue}>{fmtDate(invoice.due_date)}</Text>
            </View>
          </View>
        </View>

        {/* ─── Table ─── */}
        <View style={s.tableHeadRow}>
          <Text style={[s.headCell, s.colDesc]}>Description</Text>
          <Text style={[s.headCell, s.colUnit]}>Unit</Text>
          <Text style={[s.headCell, s.colPrice]}>Price</Text>
          <Text style={[s.headCell, s.colAmount]}>Amount</Text>
        </View>

        {items.map((item, idx) => (
          <View key={idx} style={s.itemRow}>
            <Text style={[s.descCell, s.colDesc]}>
              {item.description || 'Line item'}
            </Text>
            <Text style={[s.numCell, s.colUnit]}>{item.quantity || 1}</Text>
            <Text style={[s.numCell, s.colPrice]}>{fmtCurrency(item.unit_price)}</Text>
            <Text style={[s.numCell, s.colAmount]}>
              {fmtCurrency((item.quantity || 1) * (item.unit_price || 0))}
            </Text>
          </View>
        ))}

        {/* ─── Total ─── */}
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total Amount</Text>
          <Text style={s.totalValue}>{fmtCurrency(total)}</Text>
        </View>

        {/* ─── Notes ─── */}
        {invoice.notes ? (
          <View style={s.noteBlock}>
            <Text style={s.noteLabel}>Note</Text>
            <Text style={s.noteText}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* ─── Spacer ─── */}
        <View style={s.spacer} />

        {/* ─── Closing block ─── */}
        <View style={s.closing}>
          <View style={s.agencyBlock}>
            {renderLogo()}
            <Text style={s.agencyBlockName}>{agencyName}</Text>
            {agencyAddr.map((line, i) => (
              <Text key={i} style={s.agencyBlockLine}>{line}</Text>
            ))}
          </View>

          {(agency.signature_url || agency.signatory_name) ? (
            <View style={s.signBlock}>
              {agency.signature_url ? (
                <Image src={agency.signature_url} style={s.signImage} />
              ) : null}
              {agency.signatory_name ? (
                <Text style={s.signName}>{agency.signatory_name}</Text>
              ) : null}
              {agency.signatory_designation ? (
                <Text style={s.signRole}>{agency.signatory_designation}</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* ─── Footer ─── */}
        <View style={s.footer}>
          <View style={s.footerSide}>
            {agency.email ? <Text style={s.footerText}>{agency.email}</Text> : null}
          </View>
          <View style={[s.footerSide, { alignItems: 'center' }]}>
            {/* Velocity (basic whitelabel) keeps a subtle Tercero mark; Quantum & Ignite do not */}
            {agency.basic_whitelabel_enabled && terceroLogoDataUrl ? (
              <Image src={terceroLogoDataUrl} style={{ height: 8, maxWidth: 52, objectFit: 'contain', opacity: 0.4 }} />
            ) : null}
          </View>
          <View style={[s.footerSide, { alignItems: 'flex-end' }]}>
            {agency.agency_website ? (
              <Text style={s.footerText}>{agency.agency_website}</Text>
            ) : null}
          </View>
        </View>

      </Page>
    </Document>
  )
}
