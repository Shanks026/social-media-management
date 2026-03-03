import { format } from 'date-fns'

/* ── Helpers ── */
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
    return format(new Date(d), 'MMM dd, yyyy')
  } catch {
    return '—'
  }
}

/**
 * A pure HTML/JSX live invoice preview component.
 * Used in both Create and Edit invoice dialogs.
 */
export default function HTMLInvoicePreview({ invoice, agency }) {
  const items = invoice.items || []

  return (
    <div className="w-full bg-white text-[#111827] p-8 md:p-12 font-sans text-sm relative min-h-[842px] shadow-sm ring-1 ring-border/50">
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#111827]">Invoice</h1>
          <p className="text-[13px] text-gray-500 mt-1">#{invoice.invoice_number}</p>
        </div>
        <div className="text-right">
          {(agency.basic_whitelabel_enabled || agency.full_whitelabel_enabled) ? (
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-3">
                {agency.logo_url && (
                  <img src={agency.logo_url} alt="Logo" className="h-10 object-contain rounded-lg" />
                )}
                <span className="text-2xl font-bold tracking-tight text-[#111827]">{agency.agency_name || 'Agency'}</span>
              </div>
              {agency.basic_whitelabel_enabled && !agency.full_whitelabel_enabled && (
                <p className="text-[9px] text-gray-400 mt-1">Powered by Tercero, Ark Labs 2026</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-end">
               <h2 className="text-3xl font-extrabold tracking-tight text-[#111827]">Tercero</h2>
               <p className="text-xs font-medium text-gray-500">Ark Labs 2026</p>
            </div>
          )}
        </div>
      </div>

      <div className="border-b border-gray-200 my-4" />

      {/* Meta Grid */}
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-[10px] font-medium text-gray-500 mb-1">Project</p>
          <p className="text-[11px] font-semibold">{invoice.project_name || 'Service Retainer'}</p>
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-medium text-gray-500 mb-1">Category</p>
          <p className="text-[11px] font-semibold">{invoice.category || 'Other'}</p>
        </div>
        <div className="w-32 text-right">
          <p className="text-[10px] font-medium text-gray-500 mb-1">Issued Date</p>
          <p className="text-[11px] font-semibold">{fmtDate(invoice.issue_date)}</p>
        </div>
        <div className="w-32 text-right">
          <p className="text-[10px] font-medium text-gray-500 mb-1">Due Date</p>
          <p className="text-[11px] font-semibold">{fmtDate(invoice.due_date)}</p>
        </div>
      </div>

      <div className="border-b-2 border-gray-100 my-5" />

      {/* Address Grid */}
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-[10px] font-medium text-gray-500 mb-1">From</p>
          <div className="mt-1 space-y-0.5">
            <p className="text-[11px] font-semibold">{agency.agency_name || 'Agency Name'}</p>
            {agency.email && <p className="text-[10px] text-gray-500">{agency.email}</p>}
            {agency.mobile_number && <p className="text-[10px] text-gray-500">{agency.mobile_number}</p>}
          </div>
        </div>
        <div className="flex-1 text-right">
          <p className="text-[10px] font-medium text-gray-500 mb-1">To</p>
          <div className="mt-1 space-y-0.5">
            <p className="text-[11px] font-semibold">{invoice.client?.name || 'Client Name'}</p>
            {invoice.client?.email && <p className="text-[10px] text-gray-500">{invoice.client.email}</p>}
          </div>
        </div>
      </div>

      <div className="border-b-2 border-gray-100 my-5" />

      {/* Table Header */}
      <div className="flex bg-gray-50 rounded-md py-2.5 px-3 mb-2">
        <div className="flex-[2] text-[10px] font-semibold text-[#111827]">Description</div>
        <div className="w-16 text-center text-[10px] font-semibold text-[#111827]">Units</div>
        <div className="w-24 text-center text-[10px] font-semibold text-[#111827]">Price</div>
        <div className="w-24 text-right text-[10px] font-semibold text-[#111827]">Amount</div>
      </div>

      {/* Table Rows */}
      {items.map((item, idx) => (
        <div key={idx} className="flex py-3 px-3 border-b border-gray-200">
          <div className="flex-[2] text-[11px] font-medium text-[#111827] truncate pr-2">
            {item.description || 'Line item'}
          </div>
          <div className="w-16 text-center text-[11px] text-[#111827]">
            {item.quantity || 1}
          </div>
          <div className="w-24 text-center text-[11px] text-[#111827]">
            {fmtCurrency(item.unit_price)}
          </div>
          <div className="w-24 text-right text-[11px] text-[#111827]">
            {fmtCurrency((item.quantity || 1) * (item.unit_price || 0))}
          </div>
        </div>
      ))}

      {/* Total Amount */}
      <div className="flex justify-between items-center py-5 px-3">
        <p className="text-[13px] font-semibold text-[#111827]">Total Amount</p>
        <p className="text-[13px] font-semibold text-[#111827]">{fmtCurrency(invoice.total)}</p>
      </div>

      {/* Note Box */}
      {invoice.notes && (
        <div className="border border-gray-200 rounded-md p-3 mt-4 bg-[#FAFAFA]">
          <p className="text-[10px] text-[#111827] leading-relaxed">
            <span className="font-semibold">Note: </span>
            {invoice.notes}
          </p>
        </div>
      )}

      {/* Payment Terms */}
      {invoice.payment_terms && (
        <div className="mt-8">
          <p className="text-[11px] font-semibold mb-2">Payment Terms</p>
          <p className="text-[10px] text-gray-500">{invoice.payment_terms}</p>
        </div>
      )}


    </div>
  )
}
