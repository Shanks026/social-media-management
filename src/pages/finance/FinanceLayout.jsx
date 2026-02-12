import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useHeader } from '@/components/misc/header-context'

export default function FinanceLayout() {
  const { setHeader } = useHeader()
  const location = useLocation()

  // Dynamic Breadcrumb Logic
  useEffect(() => {
    const path = location.pathname.split('/').pop()
    const label = path.charAt(0).toUpperCase() + path.slice(1) // 'overview' -> 'Overview'

    setHeader({
      title: 'Finance Hub',
      breadcrumbs: [
        { label: 'Finance', href: '/finance/overview' },
        { label: label },
      ],
    })
  }, [setHeader, location])

  // This component now just acts as a container for the child pages
  return (
    <div className="h-full overflow-y-auto p-8 max-w-[1400px] mx-auto animate-in fade-in duration-700">
      <Outlet />
    </div>
  )
}
