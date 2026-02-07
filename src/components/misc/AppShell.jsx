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
  const [showWelcome, setShowWelcome] = useState(false) // New state for Carousel
  const [isSetupOpen, setIsSetupOpen] = useState(false) // State to control the Setup Modal
  const [loading, setLoading] = useState(true)

  const checkAgencyStatus = async () => {
    if (!user) return
    try {
      const settings = await fetchAgencySettings()
      setAgencySettings(settings)

      // Only show welcome if they haven't set up an agency name yet
      const isIncomplete =
        !settings || !settings.agency_name || settings.agency_name.trim() === ''

      if (isIncomplete) {
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

  const handleStartSetup = () => {
    setShowWelcome(false) // Hide carousel
    setIsSetupOpen(true) // Show setup modal
  }

  const handleSetupComplete = async () => {
    setIsSetupOpen(false)
    await checkAgencyStatus()
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

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
                  openAgencySetup: () => setIsSetupOpen(true), // Allow child pages to trigger setup
                }}
              />
            </AppBody>
          </div>

          {/* 1. The Welcome Introduction */}
          <WelcomeCarousel
            open={showWelcome}
            onOpenChange={setShowWelcome}
            onStartSetup={handleStartSetup}
          />

          {/* 2. The Actual Setup Modal */}
          {isSetupOpen && (
            <AgencySetupModal
              user={user}
              onComplete={handleSetupComplete}
              onClose={() => setIsSetupOpen(false)}
            />
          )}
        </div>
      </SidebarProvider>
    </HeaderProvider>
  )
}
