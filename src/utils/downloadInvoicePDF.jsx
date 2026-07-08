import { pdf } from '@react-pdf/renderer'
import InvoicePDF from '@/components/InvoicePDF'
import { supabase } from '@/lib/supabase'
import { CURRENCY } from '@/utils/constants'

const TERCERO_SVG_URL = '/TerceroLand.svg'

function isSvgUrl(url) {
  return typeof url === 'string' && url.split('?')[0].toLowerCase().endsWith('.svg')
}

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
 * Rasterize an arbitrary SVG (local or remote) to a PNG data URL, preserving
 * aspect ratio. Used for agency-supplied assets (signature, logo) that may be
 * SVG — react-pdf's <Image> cannot render SVG.
 *
 * We fetch the SVG as text and render it from a local Blob URL so the canvas is
 * never tainted (toDataURL stays usable for cross-origin Supabase URLs).
 */
async function rasterizeSvg(svgUrl, targetHeight = 180) {
  const response = await fetch(svgUrl)
  const svgText = await response.text()

  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      // Determine intrinsic size → aspect ratio (fall back to viewBox, then default)
      let w = img.naturalWidth
      let h = img.naturalHeight
      if (!w || !h) {
        const vb = svgText.match(/viewBox\s*=\s*["']([\d.\-\s,]+)["']/i)
        if (vb) {
          const p = vb[1].trim().split(/[\s,]+/).map(Number)
          w = p[2]
          h = p[3]
        }
      }
      if (!w || !h) {
        w = 400
        h = 160
      }
      const aspect = w / h
      const scale = 3 // crisp output
      const canvas = document.createElement('canvas')
      canvas.height = Math.round(targetHeight * scale)
      canvas.width = Math.round(targetHeight * aspect * scale)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png'))
      URL.revokeObjectURL(img.src)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }))
  })
}

/** Pass raster URLs through untouched; rasterize SVGs to a PNG data URL. */
async function resolveSvgField(url, targetHeight) {
  if (!isSvgUrl(url)) return url
  try {
    return await rasterizeSvg(url, targetHeight)
  } catch (err) {
    console.error('Failed to rasterize SVG asset:', err)
    return null
  }
}

/**
 * Generate an invoice PDF and return it as a Blob.
 * Shared by the download flow and the email flow so both produce an identical PDF.
 *
 * @param {object}  invoice  – Full invoice object with .client, .items, etc.
 * @param {object}  agency   – Agency settings (agency_name, logo_url, email, …)
 * @returns {Promise<Blob>}
 */
export async function generateInvoicePDFBlob(invoice, agency = {}) {
  // Ignite (no whitelabel) needs TerceroLand in the header/footer.
  // Quantum (full_whitelabel) needs neither.
  let terceroLogoDataUrl = null
  if (!agency.full_whitelabel_enabled) {
    terceroLogoDataUrl = await rasterizeTerceroLogo(TERCERO_SVG_URL, 162, 27)
  }

  // react-pdf cannot render SVG <Image>. Rasterize any SVG agency assets first.
  const [signature_url, logo_url, logo_horizontal_url] = await Promise.all([
    resolveSvgField(agency.signature_url, 200),
    resolveSvgField(agency.logo_url, 132),
    resolveSvgField(agency.logo_horizontal_url, 132),
  ])

  const resolvedAgency = { ...agency, signature_url, logo_url, logo_horizontal_url }

  return pdf(
    <InvoicePDF invoice={invoice} agency={resolvedAgency} terceroLogoDataUrl={terceroLogoDataUrl} />,
  ).toBlob()
}

/**
 * Generate and download an invoice PDF.
 *
 * @param {object}  invoice  – Full invoice object with .client, .items, etc.
 * @param {object}  agency   – Agency settings (agency_name, logo_url, email, …)
 * @returns {Promise<void>}
 */
export async function downloadInvoicePDF(invoice, agency = {}) {
  const blob = await generateInvoicePDFBlob(invoice, agency)

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${invoice.invoice_number || 'invoice'}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Read a Blob into a bare base64 string (no `data:` prefix). */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Generate the invoice PDF and email it to the client (as an attachment) via
 * the `send-invoice-email` edge function.
 *
 * @param {object} invoice        – Full invoice object with .client, .items, .total …
 * @param {object} agency         – Agency settings (branding + address)
 * @param {object} opts
 * @param {string} opts.recipientEmail
 * @param {string} [opts.recipientName]
 * @param {string} opts.agencyUserId – workspaceUserId, for branding lookup
 * @returns {Promise<object>} the edge function response
 */
export async function emailInvoicePDF(invoice, agency = {}, opts = {}) {
  const { recipientEmail, recipientName, agencyUserId } = opts
  if (!recipientEmail) throw new Error('The client has no email address on file.')

  const blob = await generateInvoicePDFBlob(invoice, agency)
  const pdf_base64 = await blobToBase64(blob)

  const totalFormatted = new Intl.NumberFormat(CURRENCY.LOCALE, {
    style: 'currency',
    currency: CURRENCY.CODE,
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(invoice.total || 0)

  const { data, error } = await supabase.functions.invoke('send-invoice-email', {
    body: {
      recipient_email: recipientEmail,
      recipient_name: recipientName || invoice.client?.name || null,
      agency_user_id: agencyUserId,
      invoice_number: invoice.invoice_number,
      total_formatted: totalFormatted,
      due_date: invoice.due_date || null,
      notes: invoice.notes || null,
      pdf_base64,
      filename: `${invoice.invoice_number || 'invoice'}.pdf`,
    },
  })

  if (error) throw error
  return data
}
