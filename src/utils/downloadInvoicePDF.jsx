import { pdf } from '@react-pdf/renderer'
import InvoicePDF from '@/components/InvoicePDF'

/**
 * Generate and download an invoice PDF.
 *
 * @param {object}  invoice  – Full invoice object with .client, .items, etc.
 * @param {object}  agency   – Agency settings (agency_name, logo_url, email, …)
 * @returns {Promise<void>}
 */
export async function downloadInvoicePDF(invoice, agency = {}) {
  const blob = await pdf(
    <InvoicePDF invoice={invoice} agency={agency} />,
  ).toBlob()

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${invoice.invoice_number || 'invoice'}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
