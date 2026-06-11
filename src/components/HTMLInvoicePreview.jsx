import { format } from 'date-fns'
import { CURRENCY } from '@/utils/constants'

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

/**
 * A pure HTML/JSX live invoice preview.
 * Mirrors InvoicePDF.jsx — used in both Create and Edit invoice dialogs.
 */
export default function HTMLInvoicePreview({ invoice, agency = {} }) {
  const items = invoice.items || []

  const isWhitelabel =
    agency.full_whitelabel_enabled || agency.basic_whitelabel_enabled
  const agencyName = agency.agency_name || 'Agency'
  const clientAddr = addressLines(invoice.client?.address)
  const agencyAddr = addressLines(agency.agency_address)

  const renderLogo = () => {
    if (isWhitelabel) {
      if (agency.logo_horizontal_url)
        return <img src={agency.logo_horizontal_url} alt="Logo" className="rounded mb-5" style={{ height: 40, width: 'auto', maxWidth: 130, objectFit: 'contain' }} />
      if (agency.logo_url)
        return <img src={agency.logo_url} alt="Logo" className="rounded mb-5" style={{ width: 44, height: 44, objectFit: 'contain' }} />
      return null
    }
    return <img src="/TerceroLand.svg" alt="Tercero" className="mb-5" style={{ height: 18, maxWidth: 110, objectFit: 'contain' }} />
  }

  return (
    <div className="w-full bg-white text-[#111827] px-10 py-10 md:px-12 md:py-12 font-sans text-sm flex flex-col min-h-[842px] shadow-sm ring-1 ring-border/50">
      {/* Header */}
      <div className="flex justify-between items-center pb-3 border-b border-[#111827]">
        <span className="text-[13px] font-bold text-[#111827]">#{invoice.invoice_number}</span>
        <span className="text-[13px] font-bold text-[#111827]">{agencyName}</span>
      </div>

      {/* Title */}
      <h1 className="text-[52px] leading-none font-normal tracking-tight text-[#111827] mt-6 mb-8">
        Invoice
      </h1>

      {/* Meta */}
      <div className="flex justify-between items-start mb-7">
        <div className="flex-1">
          <p className="text-[11px] text-gray-500 mb-1.5">Billed To</p>
          <p className="text-[13px] font-bold">{invoice.client?.name || 'Client Name'}</p>
          {clientAddr.length > 0 && (
            <div className="mt-1 max-w-[220px]">
              {clientAddr.map((line, i) => (
                <p key={i} className="text-[10px] text-gray-500 leading-snug">{line}</p>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-11">
          <div>
            <p className="text-[11px] text-gray-500 mb-1.5">Created On</p>
            <p className="text-[13px] font-bold">{fmtDate(invoice.issue_date)}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 mb-1.5">Due On</p>
            <p className="text-[13px] font-bold">{fmtDate(invoice.due_date)}</p>
          </div>
        </div>
      </div>

      {/* Table header */}
      <div className="flex items-center py-3 border-y border-dashed border-gray-300">
        <div className="flex-1 text-[11px] text-gray-500">Description</div>
        <div className="w-14 text-center text-[11px] text-gray-500">Unit</div>
        <div className="w-24 text-right text-[11px] text-gray-500">Price</div>
        <div className="w-28 text-right text-[11px] text-gray-500">Amount</div>
      </div>

      {/* Rows */}
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center py-4 border-b border-dashed border-gray-300">
          <div className="flex-1 text-[12px] font-bold text-[#111827] pr-2">
            {item.description || 'Line item'}
          </div>
          <div className="w-14 text-center text-[12px] text-[#111827]">{item.quantity || 1}</div>
          <div className="w-24 text-right text-[12px] text-[#111827]">{fmtCurrency(item.unit_price)}</div>
          <div className="w-28 text-right text-[12px] text-[#111827]">
            {fmtCurrency((item.quantity || 1) * (item.unit_price || 0))}
          </div>
        </div>
      ))}

      {/* Total */}
      <div className="flex justify-between items-center pt-5">
        <p className="text-[13px] font-semibold text-[#111827]">Total Amount</p>
        <p className="text-[22px] font-bold tracking-tight text-[#111827]">{fmtCurrency(invoice.total)}</p>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="mt-6 max-w-[320px]">
          <p className="text-[10px] font-semibold text-[#111827] mb-1">Note</p>
          <p className="text-[10px] text-gray-500 leading-relaxed">{invoice.notes}</p>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1 min-h-10" />

      {/* Closing block */}
      <div className="flex justify-between items-end mb-6">
        <div className="max-w-[260px]">
          {renderLogo()}
          <p className="text-[11px] font-bold text-[#111827] mb-1">{agencyName}</p>
          {agencyAddr.map((line, i) => (
            <p key={i} className="text-[9.5px] text-[#111827] leading-snug">{line}</p>
          ))}
        </div>

        {(agency.signature_url || agency.signatory_name) && (
          <div className="flex flex-col items-center max-w-60">
            {agency.signature_url && (
              <img src={agency.signature_url} alt="Signature" className="mb-2.5" style={{ height: 70, maxWidth: 220, objectFit: 'contain' }} />
            )}
            {agency.signatory_name && (
              <p className="text-[11px] font-bold text-[#111827]">{agency.signatory_name}</p>
            )}
            {agency.signatory_designation && (
              <p className="text-[10px] text-gray-500 mt-0.5">{agency.signatory_designation}</p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center pt-3.5 border-t border-[#111827]">
        <div className="flex-1 text-[10px] text-[#111827]">{agency.email || ''}</div>
        <div className="flex-1 flex justify-center">
          {agency.basic_whitelabel_enabled && (
            <img src="/TerceroLand.svg" alt="Tercero" style={{ height: 9, maxWidth: 52, objectFit: 'contain', opacity: 0.4 }} />
          )}
        </div>
        <div className="flex-1 text-right text-[10px] text-[#111827]">{agency.agency_website || ''}</div>
      </div>
    </div>
  )
}
