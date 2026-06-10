import { useState } from 'react'
import {
  Settings,
  Settings2,
  CreditCard,
  LifeBuoy,
  ChevronRight,
  Users,
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  SidebarGroup,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const SETTINGS_ITEMS = [
  { title: 'General Settings', url: '/settings', icon: Settings2 },
  { title: 'Team', url: '/team', icon: Users },
  { title: 'Billing & Usage', url: '/billing', icon: CreditCard },
  { title: 'Help & Info', url: '/help', icon: LifeBuoy },
]

export function NavSecondary() {
  const { state } = useSidebar()
  const location = useLocation()
  const [openPopover, setOpenPopover] = useState(false)
  const [suppressedTooltip, setSuppressedTooltip] = useState(false)

  const isCollapsed = state === 'collapsed'
  const isGroupActive = SETTINGS_ITEMS.some(
    (item) => location.pathname === item.url,
  )

  if (isCollapsed) {
    return (
      <SidebarGroup className="py-2">
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <Popover open={openPopover} onOpenChange={setOpenPopover}>
                <Tooltip
                  open={openPopover || suppressedTooltip ? false : undefined}
                >
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <SidebarMenuButton
                        isActive={isGroupActive}
                        onMouseEnter={() => setSuppressedTooltip(false)}
                      >
                        <Settings className="size-4 shrink-0" />
                      </SidebarMenuButton>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    Settings
                  </TooltipContent>
                </Tooltip>
                <PopoverContent
                  side="right"
                  sideOffset={12}
                  className="w-48 p-1.5"
                  align="start"
                >
                  <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">
                    Settings
                  </p>
                  {SETTINGS_ITEMS.map((item) => (
                    <NavLink
                      key={item.title}
                      to={item.url}
                      onClick={() => {
                        setOpenPopover(false)
                        setSuppressedTooltip(true)
                      }}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
                          isActive
                            ? 'bg-accent text-accent-foreground font-medium'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        }`
                      }
                    >
                      <item.icon className="size-3.5 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  ))}
                </PopoverContent>
              </Popover>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <SidebarGroup className="py-2">
      <SidebarGroupContent>
        <SidebarMenu>
          <Collapsible
            asChild
            defaultOpen={isGroupActive}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="Settings" isActive={isGroupActive}>
                  <Settings className="size-4 shrink-0" />
                  <span>Settings</span>
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {SETTINGS_ITEMS.map((item) => (
                    <SidebarMenuSubItem key={item.title}>
                      <SidebarMenuSubButton
                        asChild
                        isActive={location.pathname === item.url}
                      >
                        <NavLink to={item.url}>
                          <item.icon className="size-3.5 me-0.5 opacity-70" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
