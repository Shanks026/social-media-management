import { Settings, ShieldCheck, LifeBuoy, Headphones } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar'

// Data-driven object for easy scaling
const secondaryNavItems = [
  // {
  //   title: 'Support',
  //   url: '/support',
  //   icon: Headphones,
  // },
  {
    title: 'Settings',
    url: '/settings',
    icon: Settings,
  },
  // You can easily add more items here in the future:
  // { title: "Support", url: "/support", icon: LifeBuoy },
]

export function NavSecondary() {
  const { state } = useSidebar()
  const location = useLocation()

  return (
    <SidebarGroup className="py-2">
      <SidebarGroupContent>
        <SidebarMenu>
          {secondaryNavItems.map((item) => {
            const isCurrentlyActive = location.pathname === item.url

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={isCurrentlyActive}
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
