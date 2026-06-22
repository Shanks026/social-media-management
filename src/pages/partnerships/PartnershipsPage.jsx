import { useEffect } from 'react'
import { useHeader } from '@/components/misc/header-context'
import ComingSoon from '@/components/misc/ComingSoon'

export default function PartnershipsPage() {
  const { setHeader } = useHeader()

  useEffect(() => {
    setHeader({
      title: 'Partnerships',
      breadcrumbs: [{ label: 'My Organization' }, { label: 'Partnerships' }],
    })
  }, [setHeader])

  return (
    <ComingSoon
      emoji="🤝"
      accent="violet"
      title="Partnerships"
      subtitle="A clear operational record of your agency's ownership"
      status="Planned for a Future Release"
      description="A clean, operational view of your agency's partners, equity, and contributions — who owns what and what's been paid back. Owner-only."
      points={[
        {
          title: 'Maintain a partner registry',
          description: 'Co-founders, investors, and advisors.',
        },
        {
          title: 'Record equity and contributions',
          description: 'Rounds, contributions, and a simple cap table.',
        },
        {
          title: 'Track capital in and out',
          description: 'What was invested and what was paid back.',
        },
      ]}
    />
  )
}
