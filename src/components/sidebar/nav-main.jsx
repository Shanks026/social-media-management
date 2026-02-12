import {
  Home,
  UserStar,
  Calendar,
  Building2,
  Banknote,
  ChevronRight,
  PieChart,
  ListOrdered,
  CreditCard,
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

// 1. Updated Config with Children
const navItems = [
  { title: 'My Organization', url: '/myorganazation', icon: Building2 },
  { title: 'Clients', url: '/clients', icon: UserStar },
  { title: 'Calendar', url: '/calendar', icon: Calendar },
  {
    title: 'Finance',
    url: '/finance',
    icon: Banknote,
    // Add sub-menu items here
    items: [
      { title: 'Overview', url: '/finance/overview', icon: PieChart },
      {
        title: 'Subscriptions',
        url: '/finance/subscriptions',
        icon: CreditCard,
      },
      { title: 'Ledger', url: '/finance/ledger', icon: ListOrdered },
    ],
  },
]

export function NavMain() {
  const { state } = useSidebar()
  const location = useLocation()

  return (
    <SidebarGroup>
      {state === 'expanded' && (
        <SidebarGroupLabel>Navigation</SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {navItems.map((item) => {
            // Check if this item is currently active (or one of its children is)
            const isChildActive = item.items?.some(
              (sub) => location.pathname === sub.url,
            )
            const isMainActive = location.pathname === item.url || isChildActive

            // RENDER ITEM WITH CHILDREN
            if (item.items && item.items.length > 0) {
              return (
                <Collapsible
                  key={item.title}
                  asChild
                  defaultOpen={isChildActive} // Auto-open if we are on a finance page
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={isMainActive}
                      >
                        <item.icon className="size-4 shrink-0" />
                        <span>{item.title}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={location.pathname === subItem.url}
                            >
                              <NavLink to={subItem.url}>
                                {subItem.icon && (
                                  <subItem.icon className="size-3.5 mr-2 opacity-70" />
                                )}
                                <span>{subItem.title}</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )
            }

            // RENDER STANDARD ITEM
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={location.pathname === item.url}
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
