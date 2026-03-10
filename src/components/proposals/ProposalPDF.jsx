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

/* ── Register Inter ── */
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

/* ── Colours ── */
const C = {
  bg: '#FFFFFF',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  tableHeader: '#F9FAFB',
  accent: '#374151',
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

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  proposalLabel: {
    fontSize: 8,
    fontWeight: 500,
    color: C.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  proposalTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: C.text,
    letterSpacing: -0.3,
    maxWidth: 320,
  },
  logoImage: {
    height: 28,
    maxWidth: 140,
    objectFit: 'contain',
  },
  logoSmall: {
    height: 24,
    width: 24,
    objectFit: 'contain',
    borderRadius: 4,
  },
  logoText: {
    fontSize: 16,
    fontWeight: 700,
    color: C.text,
    letterSpacing: -0.3,
  },

  /* Typography */
  sectionLabel: {
    fontSize: 8,
    fontWeight: 500,
    color: C.muted,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: C.text,
    marginBottom: 6,
  },
  bodyText: {
    fontSize: 9,
    color: C.accent,
    lineHeight: 1.6,
  },
  metaValue: {
    fontSize: 10,
    fontWeight: 600,
    color: C.text,
  },

  /* Section block */
  section: {
    marginBottom: 20,
  },

  /* Meta row (Prepared for + Valid Until) */
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 0,
  },

  /* Pricing table */
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: C.tableHeader,
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontWeight: 600,
    color: C.text,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tableCell: {
    fontSize: 9,
    color: C.accent,
  },
  tableCellBold: {
    fontSize: 9,
    fontWeight: 600,
    color: C.text,
  },
  colDesc: { flex: 1 },
  colAmount: { width: 100, textAlign: 'right' },

  /* Total row */
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.tableHeader,
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: C.text,
  },
  totalValue: {
    fontSize: 10,
    fontWeight: 700,
    color: C.text,
  },

  /* Terms row */
  termsRow: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 0,
  },
  termBlock: {
    flex: 1,
  },

  /* Footer */
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
    return format(new Date(d), 'MMM d, yyyy')
  } catch {
    return '—'
  }
}

/* ── Document ── */
export default function ProposalPDF({ proposal = {}, agency = {}, terceroLogoDataUrl = null }) {
  const lineItems = proposal.line_items || []
  const total = lineItems.reduce((sum, li) => sum + (parseFloat(li.amount) || 0), 0)
  const recipientName = proposal.client_name || proposal.prospect_name || null
  const showAgencyBranding = agency.branding_agency_sidebar ?? false
  const showPoweredBy = agency.branding_powered_by ?? true

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.proposalLabel}>Proposal</Text>
            <Text style={s.proposalTitle}>{proposal.title || 'Untitled Proposal'}</Text>
          </View>

          <View style={{ alignItems: 'flex-end', justifyContent: 'flex-start' }}>
            {showAgencyBranding ? (
              agency.logo_horizontal_url ? (
                <Image src={agency.logo_horizontal_url} style={s.logoImage} />
              ) : agency.logo_url ? (
                <Image src={agency.logo_url} style={s.logoSmall} />
              ) : agency.agency_name ? (
                <Text style={s.logoText}>{agency.agency_name}</Text>
              ) : null
            ) : terceroLogoDataUrl ? (
              <Image
                src={terceroLogoDataUrl}
                style={{ width: 80, height: 14, objectFit: 'contain' }}
              />
            ) : null}
          </View>
        </View>

        <View style={s.divider} />

        {/* ── Prepared for + Valid Until ── */}
        <View style={s.metaRow}>
          <View>
            <Text style={s.sectionLabel}>Prepared for</Text>
            {recipientName ? (
              <Text style={s.metaValue}>{recipientName}</Text>
            ) : (
              <Text style={[s.metaValue, { color: C.muted }]}>—</Text>
            )}
          </View>
          {proposal.valid_until && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[s.sectionLabel, { textAlign: 'right' }]}>Valid Until</Text>
              <Text style={[s.metaValue, { textAlign: 'right' }]}>
                {fmtDate(proposal.valid_until)}
              </Text>
            </View>
          )}
        </View>

        <View style={s.thickDivider} />

        {/* ── Introduction ── */}
        {proposal.introduction?.trim() && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Introduction</Text>
            <Text style={s.bodyText}>{proposal.introduction}</Text>
          </View>
        )}

        {/* ── Scope of Work ── */}
        {proposal.scope_notes?.trim() && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Scope of Work</Text>
            <Text style={s.bodyText}>{proposal.scope_notes}</Text>
          </View>
        )}

        {/* ── Pricing ── */}
        {lineItems.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Pricing</Text>

            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, s.colDesc]}>Description</Text>
              <Text style={[s.tableHeaderCell, s.colAmount]}>Amount</Text>
            </View>

            {lineItems.map((item, i) => (
              <View key={i} style={s.tableRow}>
                <Text style={[s.tableCell, s.colDesc]}>{item.description || '—'}</Text>
                <Text style={[s.tableCellBold, s.colAmount]}>
                  {fmtCurrency(item.amount)}
                </Text>
              </View>
            ))}

            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Total</Text>
              <Text style={s.totalValue}>{fmtCurrency(total)}</Text>
            </View>
          </View>
        )}

        {/* ── Payment Terms + Contract Duration ── */}
        {(proposal.payment_terms || proposal.contract_duration) && (
          <View style={[s.section, { marginBottom: 16 }]}>
            <View style={s.termsRow}>
              {proposal.payment_terms && (
                <View style={s.termBlock}>
                  <Text style={s.sectionLabel}>Payment Terms</Text>
                  <Text style={s.metaValue}>{proposal.payment_terms}</Text>
                </View>
              )}
              {proposal.contract_duration && (
                <View style={s.termBlock}>
                  <Text style={s.sectionLabel}>Duration</Text>
                  <Text style={s.metaValue}>{proposal.contract_duration}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Additional Notes ── */}
        {proposal.notes?.trim() && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Additional Notes</Text>
            <Text style={s.bodyText}>{proposal.notes}</Text>
          </View>
        )}

        {/* ── Footer ── */}
        {showAgencyBranding ? null : showPoweredBy ? (
          <View style={s.footer}>
            <Text style={s.footerText}>Powered by Tercero</Text>
          </View>
        ) : null}

      </Page>
    </Document>
  )
}
