import { useState } from 'react'
import {
  ChevronRight,
  Lock,
  LayoutDashboard,
  Building2,
  UserStar,
  Target,
  FileText,
  Megaphone,
  Layers,
  Newspaper,
  Bell,
  Video,
  FolderOpen,
  Calendar,
  Banknote,
  PieChart,
  CreditCard,
  ListOrdered,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
  { title: 'Prospects', url: '/prospects', icon: Target },
  { title: 'Proposals', url: '/proposals', icon: FileText },
  { title: 'Campaigns', url: '/campaigns', icon: Megaphone, requiresFlag: 'campaigns' },
  {
    title: 'Operations',
    url: '/operations',
    icon: Layers,
    items: [
      { title: 'Deliverables', url: '/posts', icon: Newspaper },
      { title: 'Notes & Reminders', url: '/operations/notes', icon: Bell },
      { title: 'Meetings', url: '/operations/meetings', icon: Video },
      { title: 'Documents', url: '/documents', icon: FolderOpen },
    ],
  },
  { title: 'Calendar', url: '/calendar', icon: Calendar },
  {
    title: 'Finance',
    url: '/finance',
    icon: Banknote,
    items: [
      { title: 'Overview', url: '/finance/overview', icon: PieChart },
      { title: 'Subscriptions', url: '/finance/subscriptions', icon: CreditCard, requiresFlag: 'finance_subscriptions' },
      { title: 'Ledger', url: '/finance/ledger', icon: ListOrdered },
      { title: 'Invoices', url: '/finance/invoices', icon: FileText },
    ],
  },
]

function SubItemsList({ items, sub, isLoading, onNavigate }) {
  return (
    <>
      {items.map((subItem) => {
        const isLocked = subItem.requiresFlag && !isLoading && !sub?.[subItem.requiresFlag]

        if (isLocked) {
          return (
            <Tooltip key={subItem.title}>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md cursor-not-allowed opacity-40 select-none">
                  {subItem.icon && <subItem.icon className="size-3.5 shrink-0" />}
                  <span>{subItem.title}</span>
                  <Lock className="ml-auto size-3 shrink-0" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Available on Velocity &amp; Quantum
              </TooltipContent>
            </Tooltip>
          )
        }

        return (
          <NavLink
            key={subItem.title}
            to={subItem.url}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
                isActive
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`
            }
          >
            {subItem.icon && <subItem.icon className="size-3.5 shrink-0" />}
            <span>{subItem.title}</span>
          </NavLink>
        )
      })}
    </>
  )
}

export function NavMain() {
  const { state } = useSidebar()
  const location = useLocation()
  const { data: sub, isLoading } = useSubscription()
  const [openPopover, setOpenPopover] = useState(null)
  const [suppressedTooltip, setSuppressedTooltip] = useState(null)

  const isCollapsed = state === 'collapsed'
  const navItems = BASE_NAV_ITEMS

  return (
    <SidebarGroup>
      {!isCollapsed && (
        <SidebarGroupLabel>Navigation</SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {navItems.map((item) => {
            const isChildActive = item.items?.some(
              (child) => location.pathname === child.url,
            )
            const isMainActive = location.pathname === item.url || isChildActive
            const isTopLocked = item.requiresFlag && !isLoading && !sub?.[item.requiresFlag]

            if (item.items && item.items.length > 0) {
              // ── Collapsed: icon button + popover ──
              if (isCollapsed) {
                return (
                  <SidebarMenuItem key={item.title}>
                    <Popover
                      open={openPopover === item.title}
                      onOpenChange={(open) => setOpenPopover(open ? item.title : null)}
                    >
                      <Tooltip open={openPopover === item.title || suppressedTooltip === item.title ? false : undefined}>
                        <TooltipTrigger asChild>
                          <PopoverTrigger asChild>
                            <SidebarMenuButton
                              isActive={isMainActive}
                              onMouseEnter={() => setSuppressedTooltip(null)}
                            >
                              <item.icon className="size-4 shrink-0" />
                            </SidebarMenuButton>
                          </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8}>
                          {item.title}
                        </TooltipContent>
                      </Tooltip>
                      <PopoverContent
                        side="right"
                        sideOffset={12}
                        className="w-44 p-1.5"
                        align="start"
                      >
                        <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">
                          {item.title}
                        </p>
                        <SubItemsList
                          items={item.items}
                          sub={sub}
                          isLoading={isLoading}
                          onNavigate={() => { setOpenPopover(null); setSuppressedTooltip(item.title) }}
                        />
                      </PopoverContent>
                    </Popover>
                  </SidebarMenuItem>
                )
              }

              // ── Expanded: collapsible ──
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
                                      {subItem.icon && <subItem.icon className="size-3.5 me-0.5 opacity-70" />}
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
                                  {subItem.icon && <subItem.icon className="size-3.5 me-0.5 opacity-70" />}
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
                    {!isCollapsed && <span>{item.title}</span>}
                    {!isCollapsed && isTopLocked && (
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
