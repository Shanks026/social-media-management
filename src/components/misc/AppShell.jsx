import { HeaderProvider } from './header-context'
import { AppSidebar } from '../sidebar/app-sidebar'
import { ChatSidebar } from '../sidebar/chat-sidebar'
import { AppHeader } from './AppHeader'
import { AppBody } from './AppBody'
import { Outlet } from 'react-router-dom'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import { usePermissions } from '@/api/usePermissions'
import {
  fetchAgencySettings,
  markOnboardingComplete,
  reconcileLegacyOnboardingFlag,
} from '../../api/agency'
import OnboardingPage from '../../pages/onboarding/Onboarding'
import { SubscriptionReminder } from '../SubscriptionReminder'
import { DeletionBanner } from '../DeletionBanner'
import { useMeetingReminders } from '../../hooks/useMeetingReminders'

export function AppShell({ user }) {
  const queryClient = useQueryClient()
  const { canEditWorkspace } = usePermissions()
  const scrollContainerRef = useRef(null)
  const isCheckingRef = useRef(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isChatRoute = pathname.startsWith('/chat')

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  // Main sidebar collapses to icon-rail while in Chat (so its other pages stay
  // reachable) and is locked there — it re-expands the moment the user leaves
  // /chat. Only fires on the chat/non-chat boundary, not on every navigation,
  // so a manually-collapsed sidebar elsewhere in the app isn't fought.
  const [sidebarOpen, setSidebarOpen] = useState(!isChatRoute)
  const wasChatRouteRef = useRef(isChatRoute)
  useEffect(() => {
    if (isChatRoute !== wasChatRouteRef.current) {
      setSidebarOpen(!isChatRoute)
      wasChatRouteRef.current = isChatRoute
    }
  }, [isChatRoute])
  useMeetingReminders(user?.id)
  // Read previously-cached settings for this user so remounts skip the loading screen.
  const settingsKey = `agency_settings_${user?.id}`
  const [agencySettings, setAgencySettings] = useState(() => {
    try {
      const cached = sessionStorage.getItem(settingsKey)
      return cached ? JSON.parse(cached) : null
    } catch { return null }
  })
  const [loading, setLoading] = useState(() => {
    try { return !sessionStorage.getItem(settingsKey) } catch { return true }
  })

  // Onboarding is owner-only (see .claude/features/03-rbac-team-roles.md): every
  // field it writes — agency identity, invoice signatory, team invites — is
  // owner-only. Admins are view-only on workspace settings; members have none.
  // AuthProvider withholds children until resolveWorkspace settles, so the role
  // is already known on first render — no flash of the app before the wizard.
  const canOnboard = canEditWorkspace

  const checkAgencyStatus = useCallback(async () => {
    if (isCheckingRef.current) return
    isCheckingRef.current = true
    if (!user) {
      isCheckingRef.current = false
      return
    }
    try {
      // Refresh both the local state and the global subscription query
      await queryClient.invalidateQueries({ queryKey: ['subscription'] })
      let settings = await fetchAgencySettings()

      // One-time carry-over of the legacy per-device flag: a user who dismissed
      // onboarding on this browser before the DB column existed must not be
      // shown the wizard again. Refetch once if it wrote anything.
      if (canOnboard && settings && !settings.onboarding_completed_at) {
        try {
          if (await reconcileLegacyOnboardingFlag(user.id)) {
            settings = await fetchAgencySettings()
          }
        } catch (err) {
          console.error('AppShell: onboarding flag reconciliation failed', err)
        }
      }

      try { sessionStorage.setItem(settingsKey, JSON.stringify(settings)) } catch {}
      setAgencySettings(settings)
    } catch (err) {
      console.error('AppShell: Status check failed', err)
    } finally {
      isCheckingRef.current = false
      setLoading(false)
    }
  }, [user, queryClient, canOnboard])

  useEffect(() => {
    checkAgencyStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  if (loading)
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <span className="text-spotlight-dark text-sm font-medium tracking-wide">
          Setting things up...
        </span>
      </div>
    )

  // Show the full-page wizard instead of the AppShell layout when the owner
  // hasn't set the workspace up yet. Admins and members never see it — they
  // can't action any of it, and a teammate joining an unconfigured workspace
  // must not be handed the agency setup form.
  const isIncomplete =
    !agencySettings ||
    !agencySettings.agency_name ||
    agencySettings.agency_name.trim() === ''
  const needsOnboarding = isIncomplete && !agencySettings?.onboarding_completed_at

  if (canOnboard && needsOnboarding) {
    return (
      <OnboardingPage
        user={user}
        onComplete={async () => {
          // Hand off to the feature walkthrough. Stateless — reached by
          // navigation rather than a flag, so it needs no "seen" marker and
          // stays revisitable from Help → Guides.
          await checkAgencyStatus()
          navigate('/welcome', { replace: true })
        }}
        onSkip={async () => {
          try {
            await markOnboardingComplete({ skippedSteps: [] })
          } catch (err) {
            console.error('AppShell: failed to defer onboarding', err)
          }
          checkAgencyStatus()
        }}
      />
    )
  }

  return (
    <HeaderProvider>
      <SidebarProvider
        open={sidebarOpen}
        onOpenChange={(next) => {
          // Block reopening the main sidebar while in Chat — it only unlocks
          // by navigating away (handled by the effect above).
          if (isChatRoute && next) return
          setSidebarOpen(next)
        }}
      >
        <div className="flex min-h-screen w-full relative">
          <AppSidebar
            key={agencySettings?.agency_name || 'initial'}
            user={user}
            agencySettings={agencySettings}
          />
          {isChatRoute && <ChatSidebar />}
          <div ref={scrollContainerRef} className="flex flex-1 flex-col w-full h-screen min-w-0 overflow-y-auto overflow-x-hidden relative [scrollbar-gutter:stable]">
            <AppHeader user={user} agencySettings={agencySettings} />
            <DeletionBanner />
            <AppBody>
              <Outlet
                context={{
                  user,
                  agencySettings,
                  refreshAgency: checkAgencyStatus,
                }}
              />
            </AppBody>
          </div>

          {/* Background Subscription Reminder Service */}
          <SubscriptionReminder />
        </div>
      </SidebarProvider>
    </HeaderProvider>
  )
}
