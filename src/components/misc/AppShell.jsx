import { HeaderProvider } from './header-context'
import { AppSidebar } from '../sidebar/app-sidebar'
import { AppHeader } from './AppHeader'
import { AppBody } from './AppBody'
import { Outlet } from 'react-router-dom'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { fetchAgencySettings } from '../../api/agency'
import { completeFullAgencySetup, setupBrandingOnly } from '../../api/agency'
import CreateClientPage from '../../pages/clients/CreateClientPage'
import WelcomeCarousel from '../WelcomeCarousel' // Import the new component
import OnboardingPage from '../../pages/onboarding/Onboarding'
import { Loader2 } from 'lucide-react'
import { useMeetingReminders } from '../../hooks/useMeetingReminders'

export function AppShell({ user }) {
  const queryClient = useQueryClient()
  useMeetingReminders(user?.id)
  const [agencySettings, setAgencySettings] = useState(null)
  const [showWelcome, setShowWelcome] = useState(false)
  const [isSetupOpen, setIsSetupOpen] = useState(false)
  const [setupMode, setSetupMode] = useState('full') // 'full' or 'branding'
  const [loading, setLoading] = useState(true)
  const [hasSeenWelcomeState, setHasSeenWelcomeState] = useState(
    () => localStorage.getItem(`has_seen_welcome_${user?.id}`) === 'true'
  )

  const checkAgencyStatus = async () => {
    if (!user) return
    try {
      // Refresh both the local state and the global subscription query
      await queryClient.invalidateQueries({ queryKey: ['subscription'] })
      const settings = await fetchAgencySettings()
      setAgencySettings(settings)
      const isIncomplete =
        !settings || !settings.agency_name || settings.agency_name.trim() === ''
      const hasSeen = localStorage.getItem(`has_seen_welcome_${user.id}`) === 'true'
      
      setHasSeenWelcomeState(hasSeen)

      if (isIncomplete && !hasSeen) {
        setShowWelcome(true)
      } else if (!isIncomplete && !hasSeen) {
        // If they completed setup during onboarding, show the welcome carousel
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

  const handleSetupComplete = async () => {
    if (setupMode === 'full') {
      await queryClient.invalidateQueries({ queryKey: ['internal-client'] })
    }
    await checkAgencyStatus()
    setIsSetupOpen(false)
  }

  if (loading)
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )

  // If agency is incomplete and they haven't seen the welcome choice yet,
  // show the full-page onboarding instead of the AppShell layout.
  const isIncomplete = !agencySettings || !agencySettings.agency_name || agencySettings.agency_name.trim() === ''

  if (isIncomplete && !hasSeenWelcomeState) {
    return (
      <OnboardingPage 
        user={user} 
        onComplete={() => checkAgencyStatus()} 
        onSkip={() => {
          localStorage.setItem(`has_seen_welcome_${user.id}`, 'true')
          setHasSeenWelcomeState(true)
          checkAgencyStatus()
        }}
      />
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
          />

        </div>

        {isSetupOpen && (
          <div className="fixed inset-0 z-100 bg-background">
            <CreateClientPage
              standalone
              customSubmit={async (data) => {
                if (setupMode === 'branding') {
                  return await setupBrandingOnly(data)
                } else {
                  return await completeFullAgencySetup(data)
                }
              }}
              onSuccess={handleSetupComplete}
              onCancel={() => setIsSetupOpen(false)}
              defaultValues={{
                name: '',
                description: '',
                email: user?.email || '',
                mobile_number: '+91',
                status: 'ACTIVE',
                tier: 'INTERNAL',
                logo_url: '',
                platforms: [],
                industry: 'Internal',
                social_links: {},
              }}
            />
          </div>
        )}
      </SidebarProvider>
    </HeaderProvider>
  )
}
