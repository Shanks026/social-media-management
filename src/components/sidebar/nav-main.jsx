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
  LayoutGrid,
  FileText,
  Layers,
  Newspaper,
  StickyNote,
  Bell,
  Users,
  Video,
  LayoutDashboard,
  Lock,
  FolderOpen,
  Megaphone,
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
import { useSubscription } from '@/api/useSubscription'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const BASE_NAV_ITEMS = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'My Organization', url: '/myorganization', icon: Building2 },
  { title: 'Clients', url: '/clients', icon: UserStar },
  { title: 'Campaigns', url: '/campaigns', icon: Megaphone, requiresFlag: 'campaigns' },
  {
    title: 'Operations',
    url: '/operations',
    icon: Layers,
    items: [
      { title: 'Posts', url: '/posts', icon: Newspaper },
      {
        title: 'Notes & Reminders',
        url: '/operations/notes',
        icon: Bell,
      },
      {
        title: 'Meetings',
        url: '/operations/meetings',
        icon: Video,
      },
      {
        title: 'Documents',
        url: '/documents',
        icon: FileText,
      },
    ],
  },
  { title: 'Calendar', url: '/calendar', icon: Calendar },
  {
    title: 'Finance',
    url: '/finance',
    icon: Banknote,
    items: [
      { title: 'Overview', url: '/finance/overview', icon: PieChart },
      {
        title: 'Subscriptions',
        url: '/finance/subscriptions',
        icon: CreditCard,
        requiresFlag: 'finance_subscriptions',
      },
      { title: 'Ledger', url: '/finance/ledger', icon: ListOrdered },
      { title: 'Invoices', url: '/finance/invoices', icon: FileText },
    ],
  },
]

export function NavMain() {
  const { state } = useSidebar()
  const location = useLocation()
  const { data: sub, isLoading } = useSubscription()

  // Keep all items — locked ones are shown as disabled rather than hidden
  const navItems = BASE_NAV_ITEMS

  return (
    <SidebarGroup>
      {state === 'expanded' && (
        <SidebarGroupLabel>Navigation</SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {navItems.map((item) => {
            const isChildActive = item.items?.some(
              (sub) => location.pathname === sub.url,
            )
            const isMainActive = location.pathname === item.url || isChildActive
            const isTopLocked = item.requiresFlag && !isLoading && !sub?.[item.requiresFlag]

            if (item.items && item.items.length > 0) {
              return (
                <Collapsible
                  key={item.title}
                  asChild
                  defaultOpen={isChildActive}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={isMainActive}
                      >
                        <item.icon className="size-4 me-0.5 shrink-0" />
                        <span>{item.title}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items.map((subItem) => {
                          const isLocked =
                            subItem.requiresFlag &&
                            !isLoading &&
                            !sub?.[subItem.requiresFlag]

                          if (isLocked) {
                            return (
                              <SidebarMenuSubItem key={subItem.title}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <SidebarMenuSubButton
                                      className="cursor-not-allowed opacity-40 hover:bg-transparent hover:text-inherit"
                                    >
                                      {subItem.icon && (
                                        <subItem.icon className="size-3.5 me-0.5 opacity-70" />
                                      )}
                                      <span>{subItem.title}</span>
                                      <Lock className="ml-auto size-3 shrink-0" />
                                    </SidebarMenuSubButton>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" sideOffset={8}>
                                    Available on Velocity &amp; Quantum
                                  </TooltipContent>
                                </Tooltip>
                              </SidebarMenuSubItem>
                            )
                          }

                          return (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={location.pathname === subItem.url}
                              >
                                <NavLink to={subItem.url}>
                                  {subItem.icon && (
                                    <subItem.icon className="size-3.5 me-0.5 opacity-70" />
                                  )}
                                  <span>{subItem.title}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )
            }

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
                    {state === 'expanded' && isTopLocked && (
                      <Lock className="ml-auto size-3 shrink-0 text-muted-foreground" />
                    )}
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
