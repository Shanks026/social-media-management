import { HeaderProvider } from './header-context'
import { AppSidebar } from '../sidebar/app-sidebar'
import { AppHeader } from './AppHeader'
import { AppBody } from './AppBody'
import { Outlet } from 'react-router-dom'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useState, useEffect } from 'react'

import { fetchAgencySettings } from '../../api/agency'
import { AgencySetupModal } from '../AgencySetupModal'
import WelcomeCarousel from '../WelcomeCarousel' // Import the new component
import { Loader2 } from 'lucide-react'

export function AppShell({ user }) {
  const [agencySettings, setAgencySettings] = useState(null)
  const [showWelcome, setShowWelcome] = useState(false)
  const [isSetupOpen, setIsSetupOpen] = useState(false)
  const [setupMode, setSetupMode] = useState('full') // 'full' or 'branding'
  const [loading, setLoading] = useState(true)

  const checkAgencyStatus = async () => {
    if (!user) return
    try {
      const settings = await fetchAgencySettings()
      setAgencySettings(settings)
      const isIncomplete =
        !settings || !settings.agency_name || settings.agency_name.trim() === ''
      const hasSeenWelcome = localStorage.getItem(`has_seen_welcome_${user.id}`)

      if (isIncomplete && !hasSeenWelcome) {
        setShowWelcome(true)
      }
    } catch (err) {
      console.error('AppShell: Status check failed', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkAgencyStatus()
  }, [user])

  const handleStartFullSetup = () => {
    localStorage.setItem(`has_seen_welcome_${user.id}`, 'true')
    setShowWelcome(false)
    setSetupMode('full')
    setIsSetupOpen(true)
  }

  const handleStartBrandingOnly = () => {
    localStorage.setItem(`has_seen_welcome_${user.id}`, 'true')
    setShowWelcome(false)
    setSetupMode('branding')
    setIsSetupOpen(true)
  }

  const handleSetupComplete = async () => {
    setIsSetupOpen(false)
    await checkAgencyStatus()
  }

  if (loading)
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )

  return (
    <HeaderProvider>
      <SidebarProvider defaultOpen={true}>
        <div className="flex min-h-screen w-full relative">
          <AppSidebar
            key={agencySettings?.agency_name || 'initial'}
            user={user}
            agencySettings={agencySettings}
          />
          <div className="flex flex-1 flex-col w-full min-w-0">
            <AppHeader user={user} agencySettings={agencySettings} />
            <AppBody>
              <Outlet
                context={{
                  user,
                  agencySettings,
                  refreshAgency: checkAgencyStatus,
                  openAgencySetup: () => {
                    setSetupMode('full')
                    setIsSetupOpen(true)
                  },
                }}
              />
            </AppBody>
          </div>

          <WelcomeCarousel
            user={user}
            open={showWelcome}
            onOpenChange={(val) => {
              setShowWelcome(val)
              if (!val)
                localStorage.setItem(`has_seen_welcome_${user.id}`, 'true')
            }}
            onStartFullSetup={handleStartFullSetup}
            onStartBrandingOnly={handleStartBrandingOnly}
          />

          {isSetupOpen && (
            <AgencySetupModal
              user={user}
              mode={setupMode}
              onComplete={handleSetupComplete}
              onClose={() => setIsSetupOpen(false)}
            />
          )}
        </div>
      </SidebarProvider>
    </HeaderProvider>
  )
}
