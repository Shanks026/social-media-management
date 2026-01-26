import { HeaderProvider } from './header-context'
import { AppSidebar } from '../sidebar/app-sidebar'
import { AppHeader } from './AppHeader'
import { AppBody } from './AppBody'
import { Outlet } from 'react-router-dom'
import { SidebarProvider } from '@/components/ui/sidebar' // Import this

export function AppShell({ user }) {
  return (
    <HeaderProvider>
      {/* SidebarProvider handles the mobile breakpoint (md: 768px) automatically */}
      <SidebarProvider defaultOpen={true}>
        <div className="flex min-h-screen w-full">
          <AppSidebar user={user} />

          <div className="flex flex-1 flex-col w-full min-w-0">
            <AppHeader user={user} />
            <AppBody>
              <Outlet context={{ user }} />
            </AppBody>
          </div>
        </div>
      </SidebarProvider>
    </HeaderProvider>
  )
}
