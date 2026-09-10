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
  Send,
  ListTodo,
  NotebookPen,
  Video,
  FolderOpen,
  FileBarChart,
  Calendar,
  Banknote,
  PieChart,
  CreditCard,
  ListOrdered,
  TrendingUp,
  Rocket,
  Briefcase,
  Users,
  Handshake,
  BadgeDollarSign,
  Settings,
  Settings2,
  LifeBuoy,
  ShieldCheck,
  ClipboardCheck,
  PencilRuler,
  MessageCircle,
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
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
import { usePermissions } from '@/api/usePermissions'
import { cn } from '@/lib/utils'
import { usePendingApprovalsCount, useMySubmissionsCount } from '@/api/posts'
import { useMyOpenTaskCount } from '@/api/tasks'
import { useChatUnreadSummary } from '@/api/chat'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const BASE_NAV_ITEMS = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Chat', url: '/chat', icon: MessageCircle, requiresFlag: 'chat', showChatIndicator: true },
  {
    title: 'My Organization',
    url: '/myorganization',
    icon: Building2,
    items: [
      { title: 'Workspace', url: '/myorganization', icon: Briefcase },
      { title: 'Team', url: '/team', icon: Users },
      // { title: 'Partnerships', url: '/partnerships', icon: Handshake },
    ],
  },
  {
    title: 'Outreach',
    url: '/outreach',
    icon: Rocket,
    items: [
      { title: 'Prospects', url: '/prospects', icon: Target, requiresPermission: 'prospects' },
      { title: 'Proposals', url: '/proposals', icon: FileText, requiresPermission: 'proposals' },
    ],
  },
  { title: 'Clients', url: '/clients', icon: UserStar },

  { title: 'Deliverables', url: '/deliverables', icon: PencilRuler },
  { title: 'Submissions', url: '/submissions', icon: Send, showChangesCount: true, requiresPermission: 'isTeamMember' },
  {
    title: 'Approvals',
    url: '/approvals',
    icon: ClipboardCheck,
    requiresPermission: 'canSendDeliverables',
    showCount: true,
  },
  {
    title: 'Campaigns',
    url: '/campaigns',
    icon: Megaphone,
    requiresFlag: 'campaigns',
  },
  // { title: 'Ads', url: '/ads', icon: BadgeDollarSign },
  { title: 'Tasks & Todos', url: '/tasks', icon: ListTodo, showTodoCount: true },
  {
    title: 'Operations',
    url: '/operations',
    icon: Layers,
    items: [
      { title: 'Notes', url: '/operations/notes', icon: NotebookPen },
      { title: 'Meetings', url: '/operations/meetings', icon: Video },
      { title: 'Documents', url: '/documents', icon: FolderOpen, requiresPermission: 'hasDocuments' },
      {
        title: 'Reports',
        url: '/reports',
        icon: FileBarChart,
        requiresFlag: 'reports',
        requiresPermission: 'reports',
      },
    ],
  },
  { title: 'Calendar', url: '/calendar', icon: Calendar },
  {
    title: 'Finance',
    url: '/finance',
    icon: Banknote,
    requiresPermission: 'finance',
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
  {
    title: 'Settings',
    url: '/settings',
    icon: Settings,
    items: [
      { title: 'General', url: '/settings', icon: Settings2 },
      { title: 'Billing & Usage', url: '/billing', icon: CreditCard, requiresPermission: 'canBilling' },
      { title: 'Help & Info', url: '/help', icon: LifeBuoy },
    ],
  },
]

function SubItemsList({ items, sub, isLoading, onNavigate }) {
  return (
    <>
      {items.map((subItem) => {
        const isLocked =
          subItem.requiresFlag && !isLoading && !sub?.[subItem.requiresFlag]

        if (isLocked) {
          return (
            <Tooltip key={subItem.title}>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md cursor-not-allowed opacity-40 select-none">
                  {subItem.icon && (
                    <subItem.icon className="size-3.5 shrink-0" />
                  )}
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
                  : 'text-foreground hover:bg-accent hover:text-accent-foreground'
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

/**
 * The single attention indicator for a nav item, or null.
 *
 * At most one is returned on purpose: SidebarMenuBadge is absolutely
 * positioned in the item's top-right, so two would sit on top of each other.
 * The item flags are already mutually exclusive; the ordering here only
 * decides the chat case, where an unread @mention outranks a plain unread
 * count as the higher-attention signal.
 *
 * Two fills, not one per counter. Every badge here sits directly beside a
 * label that already names it ("Approvals", "Tasks & Todos"), so a different
 * hue per counter would be restating the adjacent word in color rather than
 * adding anything — and spending warning tones (amber, rose) on routine
 * inventory leaves nothing louder for the case that genuinely needs it. So:
 * brand primary for "you have N of these", and rose for the one signal that
 * means act now — an unread @mention.
 *
 * Soft -100/-700 tints (and -900/30 over -300 in dark), the same chip
 * treatment the role badges use, rather than a solid fill. Measured on the
 * sidebar: 5.59:1 light / 8.77:1 dark for blue, 5.04:1 / 8.48:1 for rose.
 *
 * Blue is the literal hue rather than the `primary` token because the token
 * has no -100 step to tint with; it sits in the same family, so the badges
 * still read as brand-colored.
 *
 * Shape overrides the shadcn default of rounded-md/text-xs to a tighter
 * rounded-sm chip at text-[10px]. The h-5/min-w-5 box is deliberately left alone
 * — the badge's vertical placement comes from peer-data-[size]/menu-button:top-*
 * rules tuned to that height, so changing it would sit the chip off-center.
 */
const BADGE_SHAPE = 'h-5 min-w-5 rounded-sm px-1.5 text-[10px] font-semibold'
const COUNT_BADGE = cn(BADGE_SHAPE, 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300')
const URGENT_BADGE = cn(BADGE_SHAPE, 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300')

function resolveBadge(item, counts) {
  const cap = (n) => (n > 99 ? '99+' : String(n))
  if (item.showCount && counts.approvalCount > 0)
    return { label: cap(counts.approvalCount), className: COUNT_BADGE }
  if (item.showChangesCount && counts.submissionsChangesCount > 0)
    return { label: cap(counts.submissionsChangesCount), className: COUNT_BADGE }
  if (item.showTodoCount && counts.myOpenTaskCount > 0)
    return { label: cap(counts.myOpenTaskCount), className: COUNT_BADGE }
  if (item.showChatIndicator && counts.chatHasMention)
    return { label: '@', className: cn(URGENT_BADGE, 'font-bold') }
  if (item.showChatIndicator && counts.chatUnreadCount > 0)
    return { label: cap(counts.chatUnreadCount), className: COUNT_BADGE }
  return null
}

export function NavMain() {
  const { state } = useSidebar()
  const location = useLocation()
  const { data: sub, isLoading } = useSubscription()
  const perms = usePermissions()
  const { data: approvalCount = 0 } = usePendingApprovalsCount()
  const { data: submissionsChangesCount = 0 } = useMySubmissionsCount('CHANGES_REQUESTED')
  const { data: myOpenTaskCount = 0 } = useMyOpenTaskCount()
  const { count: chatUnreadCount, hasMention: chatHasMention } = useChatUnreadSummary({ enabled: !!sub?.chat })
  const [openPopover, setOpenPopover] = useState(null)
  const [suppressedTooltip, setSuppressedTooltip] = useState(null)

  const isCollapsed = state === 'collapsed'

  // RBAC: hide items the user lacks permission for (vs requiresFlag, which locks).
  // Filter sub-items first, then drop any parent group left with no children.
  const allowed = (node) => !node.requiresPermission || perms[node.requiresPermission]
  const navItems = BASE_NAV_ITEMS.filter(allowed)
    .map((item) =>
      item.items ? { ...item, items: item.items.filter(allowed) } : item,
    )
    .filter((item) => !item.items || item.items.length > 0)

  return (
    <SidebarGroup>
      {!isCollapsed && <SidebarGroupLabel>Navigation</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {navItems.map((item) => {
            const isChildActive = item.items?.some(
              (child) => location.pathname === child.url,
            )
            const isMainActive = location.pathname === item.url || isChildActive
            const isTopLocked =
              item.requiresFlag && !isLoading && !sub?.[item.requiresFlag]

            if (item.items && item.items.length > 0) {
              // ── Collapsed: icon button + popover ──
              if (isCollapsed) {
                return (
                  <SidebarMenuItem key={item.title}>
                    <Popover
                      open={openPopover === item.title}
                      onOpenChange={(open) =>
                        setOpenPopover(open ? item.title : null)
                      }
                    >
                      <Tooltip
                        open={
                          openPopover === item.title ||
                          suppressedTooltip === item.title
                            ? false
                            : undefined
                        }
                      >
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
                        <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                          {item.title}
                        </p>
                        <SubItemsList
                          items={item.items}
                          sub={sub}
                          isLoading={isLoading}
                          onNavigate={() => {
                            setOpenPopover(null)
                            setSuppressedTooltip(item.title)
                          }}
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
                        <item.icon className="size-4 shrink-0" />
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
                                    <SidebarMenuSubButton className="cursor-not-allowed opacity-40 hover:bg-transparent hover:text-inherit">
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

            // Locked top-level items previously stayed fully clickable (just a
            // passive Lock icon tacked on) — inconsistent with how locked
            // sub-items are already treated above. Match that: disabled,
            // dimmed, non-navigable, with a tooltip explaining why.
            if (isTopLocked) {
              return (
                <SidebarMenuItem key={item.title}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton className="cursor-not-allowed opacity-40 hover:bg-transparent hover:text-inherit">
                        <item.icon className="size-4 shrink-0" />
                        {!isCollapsed && <span>{item.title}</span>}
                        {!isCollapsed && (
                          <Lock className="ml-auto size-3 shrink-0" />
                        )}
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      Available on Velocity &amp; Quantum
                    </TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
              )
            }

            const badge = resolveBadge(item, {
              approvalCount,
              submissionsChangesCount,
              myOpenTaskCount,
              chatUnreadCount,
              chatHasMention,
            })
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
                  </NavLink>
                </SidebarMenuButton>
                {/* Sibling of the button, not a child of it — SidebarMenuBadge
                    is absolutely positioned against SidebarMenuItem and reads
                    the button's state through peer-* classes, so nesting it
                    inside the NavLink would break both its placement and its
                    hover/active colors. It also hides itself when the sidebar
                    collapses to icons, which is why there's no isCollapsed
                    guard here. */}
                {badge && (
                  <SidebarMenuBadge className={badge.className}>{badge.label}</SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
