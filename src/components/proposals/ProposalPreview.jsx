import { format } from 'date-fns'

function fmtCurrency(val) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
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

/**
 * Pure HTML/JSX live preview for a proposal.
 * Mirrors HTMLInvoicePreview pattern — always renders white doc on coloured background.
 * @param {{ proposal: object, agency: object }} props
 */
export default function ProposalPreview({ proposal = {}, agency = {} }) {
  const lineItems = proposal.line_items || []
  const total = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
  const recipientName = proposal.client_name || proposal.prospect_name || null
  const showAgencyBranding = agency?.branding_agency_sidebar ?? false

  return (
    <div className="w-full bg-white text-[#111827] p-8 md:p-10 font-sans text-sm relative min-h-[842px] shadow-sm ring-1 ring-border/50">

      {/* ── Header ── */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em] mb-1">
            Proposal
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827] leading-tight">
            {proposal.title || 'Untitled Proposal'}
          </h1>
        </div>

        {/* Agency logo / Tercero fallback */}
        <div className="shrink-0 text-right">
          {showAgencyBranding ? (
            agency?.logo_horizontal_url ? (
              <img
                src={agency.logo_horizontal_url}
                alt={agency.agency_name}
                style={{ height: '36px', width: 'auto', display: 'block' }}
                className="rounded"
              />
            ) : agency?.logo_url ? (
              <img
                src={agency.logo_url}
                alt={agency.agency_name}
                style={{ height: '28px', width: '28px', objectFit: 'contain' }}
                className="rounded"
              />
            ) : (
              <span className="text-xl font-bold tracking-tight text-[#111827]">
                {agency?.agency_name || 'Agency'}
              </span>
            )
          ) : (
            <img
              src="/TerceroLand.svg"
              alt="Tercero"
              style={{ height: '22px', maxWidth: '110px', objectFit: 'contain', marginTop: '4px' }}
            />
          )}
        </div>
      </div>

      <div className="border-b border-gray-200 my-5" />

      {/* ── Prepared for + Validity ── */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
            Prepared for
          </p>
          <p className="font-semibold text-[15px] text-[#111827]">
            {recipientName || <span className="text-gray-300 italic font-normal">Client name</span>}
          </p>
        </div>

        {proposal.valid_until && (
          <div className="text-right">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
              Valid until
            </p>
            <p className="text-[13px] text-[#374151]">{fmtDate(proposal.valid_until)}</p>
          </div>
        )}
      </div>

      {/* ── Introduction ── */}
      {proposal.introduction?.trim() && (
        <div className="mb-7">
          <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Introduction
          </h2>
          <p className="text-[13px] text-[#374151] whitespace-pre-wrap leading-relaxed">
            {proposal.introduction}
          </p>
        </div>
      )}

      {/* ── Scope of work ── */}
      {proposal.scope_notes?.trim() && (
        <div className="mb-7">
          <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Scope of Work
          </h2>
          <p className="text-[13px] text-[#374151] whitespace-pre-wrap leading-relaxed">
            {proposal.scope_notes}
          </p>
        </div>
      )}

      {/* ── Pricing ── */}
      {lineItems.length > 0 && (
        <div className="mb-7">
          <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Pricing
          </h2>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 text-gray-500 font-medium">Description</th>
                <th className="text-right py-2 text-gray-500 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2.5 text-[#374151]">{item.description || '—'}</td>
                  <td className="py-2.5 text-right font-medium text-[#111827]">
                    {fmtCurrency(item.amount)}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50">
                <td className="py-3 px-0 font-bold text-[#111827]">Total</td>
                <td className="py-3 text-right font-bold text-[#111827]">{fmtCurrency(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── Payment terms + Contract duration ── */}
      {(proposal.payment_terms || proposal.contract_duration) && (
        <div className="flex gap-10 mb-7">
          {proposal.payment_terms && (
            <div>
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                Payment Terms
              </p>
              <p className="text-[13px] text-[#374151]">{proposal.payment_terms}</p>
            </div>
          )}
          {proposal.contract_duration && (
            <div>
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                Duration
              </p>
              <p className="text-[13px] text-[#374151]">{proposal.contract_duration}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Additional notes ── */}
      {proposal.notes?.trim() && (
        <div className="mb-6">
          <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Additional Notes
          </h2>
          <p className="text-[13px] text-[#374151] whitespace-pre-wrap leading-relaxed">
            {proposal.notes}
          </p>
        </div>
      )}
    </div>
  )
}
