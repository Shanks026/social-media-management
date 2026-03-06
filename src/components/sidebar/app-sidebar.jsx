import { useEffect } from 'react'
import { AppSidebarHeader } from './nav-header'
import { NavMain } from './nav-main'
import { NavClients } from './nav-clients'
import { NavUser } from './nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar'
import { Separator } from '../ui/separator'
import { NavSecondary } from './nav-secondary'
import { SidebarSubCard } from './sidebar-sub-card'
import { useSubscription } from '@/api/useSubscription'

export function AppSidebar({ user, agencySettings }) {
  const { isMobile, setOpen, state } = useSidebar()
  const { data: sub } = useSubscription()
  const isCollapsed = state === 'collapsed' && !isMobile

  useEffect(() => {
    if (isMobile) {
      setOpen(true)
    }
  }, [isMobile, setOpen])

  return (
    <Sidebar
        className="border-r flex flex-col overflow-x-hidden"
        collapsible="icon"
        variant="custom"
      >
        <AppSidebarHeader agencySettings={agencySettings} />
        <Separator />
        {/* Main Content Area: Takes up all available height */}
        <SidebarContent className="flex flex-col flex-1 min-h-0 overflow-x-hidden">
          <NavMain />

          {/* This is the magic part: flex-1 makes this grow to push settings down */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <NavClients />
          </div>

          <div className="flex flex-col gap-0 overflow-hidden">
            <SidebarSubCard />

            <NavSecondary />
          </div>
        </SidebarContent>

        {!isCollapsed && sub?.branding_powered_by && (
          <div className="px-4 pb-1">
            <p className="text-[10px] text-muted-foreground/40 select-none">
              Tercero {new Date().getFullYear()}
            </p>
          </div>
        )}

        <Separator />
        <SidebarFooter className="shrink-0">
          <NavUser user={user} />
        </SidebarFooter>
      </Sidebar>
  )
}
