import { useEffect, useState } from 'react'
import { AppSidebarHeader } from './nav-header'
import { NavMain } from './nav-main'
import { NavClients } from './nav-clients'
import { NavUser } from './nav-user'
import { Sidebar, SidebarContent, SidebarFooter, useSidebar } from '@/components/ui/sidebar'
import { Separator } from '../ui/separator'
import CreateClient from '../../pages/CreateClient'
import EditClient from '../../pages/EditClient'
import { NavSecondary } from './nav-secondary'
import { SidebarSubCard } from './sidebar-sub-card'

export function AppSidebar({ user }) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editClient, setEditClient] = useState(null)
  const { isMobile, setOpen, open } = useSidebar()

  useEffect(() => {
    if (isMobile) {
      setOpen(true)
    }
  }, [isMobile, setOpen])

  return (
    <>
      <Sidebar
        className="border-r flex flex-col overflow-x-hidden"
        collapsible="icon"
        variant="custom"
      >
        <AppSidebarHeader />
        <Separator />
        {/* Main Content Area: Takes up all available height */}
        <SidebarContent className="flex flex-col flex-1 min-h-0 overflow-x-hidden">
          <NavMain />

          {/* This is the magic part: flex-1 makes this grow to push settings down */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <NavClients
              onCreateOpen={() => setCreateOpen(true)}
              onEditClient={(client) => setEditClient(client)}
            />
          </div>

          {/* <Separator className="mt-auto" /> */}
          <SidebarSubCard />
          {/* Settings Section: Now pinned just above the footer */}
          <NavSecondary />
        </SidebarContent>

        <Separator />
        <SidebarFooter className="flex-shrink-0">
          <NavUser user={user} />
        </SidebarFooter>
      </Sidebar>

      <CreateClient open={createOpen} onOpenChange={setCreateOpen} />
      {editClient && (
        <EditClient client={editClient} onClose={() => setEditClient(null)} />
      )}
    </>
  )
}
