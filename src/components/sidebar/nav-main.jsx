import { Home, UserStar, Settings } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar'

const navItems = [
  // { title: 'Home', url: '/', icon: Home },
  { title: 'Clients', url: '/clients', icon: UserStar },
]

export function NavMain() {
  const { state } = useSidebar()
  const location = useLocation()

  return (
    <SidebarGroup className="flex-none">
      {state === 'expanded' && (
        <SidebarGroupLabel>Navigation</SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {navItems.map((item) => {
            const isCurrentlyActive = location.pathname === item.url

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={isCurrentlyActive} // shadcn property for background
                  className={`flex items-center h-9 transition-colors ${
                    state === 'collapsed' ? 'justify-center p-0' : 'px-2 gap-3'
                  }`}
                >
                  <NavLink to={item.url}>
                    <item.icon className="size-4 shrink-0" />
                    {state === 'expanded' && <span>{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
