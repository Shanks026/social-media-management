import { pdf } from '@react-pdf/renderer'
import InvoicePDF from '@/components/InvoicePDF'

const TERCERO_SVG_URL = '/TerceroLand.svg'

/**
 * Fetch the TerceroLand SVG and rasterize it to a PNG data URL via canvas.
 * react-pdf's Image component cannot render SVG files, so we convert first.
 */
async function rasterizeTerceroLogo(svgUrl, renderWidth, renderHeight) {
  const response = await fetch(svgUrl)
  const svgText = await response.text()

  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    // Render at 3× for crisp output
    canvas.width = renderWidth * 3
    canvas.height = renderHeight * 3
    const ctx = canvas.getContext('2d')

    const img = new window.Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png'))
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }))
  })
}

/**
 * Generate and download an invoice PDF.
 *
 * @param {object}  invoice  – Full invoice object with .client, .items, etc.
 * @param {object}  agency   – Agency settings (agency_name, logo_url, email, …)
 * @returns {Promise<void>}
 */
export async function downloadInvoicePDF(invoice, agency = {}) {
  // Ignite (no whitelabel) needs TerceroLand in the header.
  // Velocity (basic_whitelabel) needs TerceroLand in the footer.
  // Quantum (full_whitelabel) needs neither.
  let terceroLogoDataUrl = null
  if (!agency.full_whitelabel_enabled) {
    terceroLogoDataUrl = await rasterizeTerceroLogo(TERCERO_SVG_URL, 162, 27)
  }

  const blob = await pdf(
    <InvoicePDF invoice={invoice} agency={agency} terceroLogoDataUrl={terceroLogoDataUrl} />,
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
