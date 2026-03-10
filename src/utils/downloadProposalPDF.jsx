import { pdf } from '@react-pdf/renderer'
import ProposalPDF from '@/components/proposals/ProposalPDF'
import { format } from 'date-fns'

const TERCERO_SVG_URL = '/TerceroLand.svg'

async function rasterizeTerceroLogo(svgUrl, renderWidth, renderHeight) {
  const response = await fetch(svgUrl)
  const svgText = await response.text()

  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
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
 * Generate and download a proposal PDF.
 *
 * @param {object} proposal – Proposal object with line_items, title, etc.
 * @param {object} agency   – Agency branding (agency_name, logo_url, branding_agency_sidebar, etc.)
 */
export async function downloadProposalPDF(proposal, agency = {}) {
  // Rasterize Tercero logo when agency branding is not shown
  let terceroLogoDataUrl = null
  if (!agency.branding_agency_sidebar) {
    terceroLogoDataUrl = await rasterizeTerceroLogo(TERCERO_SVG_URL, 162, 27)
  }

  const blob = await pdf(
    <ProposalPDF
      proposal={proposal}
      agency={agency}
      terceroLogoDataUrl={terceroLogoDataUrl}
    />,
  ).toBlob()

  // Build filename: Proposal-ClientName-YYYY-MM-DD.pdf
  const recipientName = proposal.client_name || proposal.prospect_name || 'Proposal'
  const safeName = recipientName.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').trim()
  const dateStr = format(new Date(), 'yyyy-MM-dd')
  const filename = `Proposal-${safeName}-${dateStr}.pdf`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
