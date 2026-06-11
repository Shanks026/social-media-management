import { pdf } from '@react-pdf/renderer'
import ClientReportPDF from '@/components/reports/ClientReportPDF'

function isSvgUrl(url) {
  return typeof url === 'string' && url.split('?')[0].toLowerCase().endsWith('.svg')
}

/**
 * Rasterize an SVG (local or remote) to a PNG data URL, preserving aspect ratio.
 * react-pdf's <Image> cannot render SVG. Rendered from a local Blob URL so the
 * canvas is never tainted (toDataURL stays usable for cross-origin URLs).
 */
async function rasterizeSvg(svgUrl, targetHeight = 96) {
  const response = await fetch(svgUrl)
  const svgText = await response.text()
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
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
      const scale = 3
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

async function resolveLogo(url) {
  if (!isSvgUrl(url)) return url
  try {
    return await rasterizeSvg(url)
  } catch (err) {
    console.error('Failed to rasterize agency logo:', err)
    return null
  }
}

/**
 * Generate and download a per-client report PDF.
 *
 * @param {object} report   – payload from get_client_report RPC
 * @param {object} agency   – { agency_name, logo_url, email, website }
 * @param {Date}   [generatedOn]
 */
export async function downloadClientReportPDF(report, agency = {}, generatedOn = new Date()) {
  const agencyLogoUrl = await resolveLogo(agency.logo_url)

  const blob = await pdf(
    <ClientReportPDF
      report={report}
      agencyName={agency.agency_name}
      agencyLogoUrl={agencyLogoUrl}
      agencyEmail={agency.email}
      agencyWebsite={agency.website}
      generatedOn={generatedOn}
    />,
  ).toBlob()

  const clientSlug = (report?.client?.name || 'client')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${clientSlug}-report.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
