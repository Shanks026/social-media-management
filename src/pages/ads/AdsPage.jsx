import { useEffect } from 'react'
import { useHeader } from '@/components/misc/header-context'
import ComingSoon from '@/components/misc/ComingSoon'

export default function AdsPage() {
  const { setHeader } = useHeader()

  useEffect(() => {
    setHeader({
      title: 'Ads',
      breadcrumbs: [{ label: 'Ads' }],
    })
  }, [setHeader])

  return (
    <ComingSoon
      emoji="📺"
      accent="indigo"
      title="Ads"
      subtitle="Paid media management, built into your workflow"
      status="Coming Soon"
      description="Manage every paid campaign you run for clients — budgets, the spend you front, and what you bill back, all in one place."
      points={[
        {
          title: 'Track spend and budgets',
          description: 'Per client and platform — Meta, Google, LinkedIn.',
        },
        {
          title: 'Keep billing airtight',
          description: 'Link spend to invoices so nothing goes unbilled.',
        },
        {
          title: 'Paid and organic, side by side',
          description: 'The full picture for every client.',
        },
      ]}
    />
  )
}
