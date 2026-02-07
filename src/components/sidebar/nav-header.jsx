import { useSubscription } from '@/api/useSubscription'
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { Skeleton } from '../ui/skeleton'

export function AppSidebarHeader() {
  const { state, isMobile } = useSidebar()
  const { data: sub, isLoading } = useSubscription()

  // This ensures we only hide things if we are on Desktop AND Collapsed
  const isCollapsed = state === 'collapsed' && !isMobile

  const getInitials = (name) => {
    return name
      ? name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : '??'
  }

  return (
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem className="flex items-center">
          <SidebarMenuButton
            size="lg"
            className="hover:bg-transparent cursor-default"
          >
            {/* LOGO SECTION */}
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0 overflow-hidden shadow-sm">
              {isLoading ? (
                <Skeleton className="size-full bg-primary-foreground/20" />
              ) : sub?.logo_url ? (
                <img
                  src={sub.logo_url}
                  alt={sub.agency_name}
                  className="size-full object-cover"
                />
              ) : (
                <span className="text-[10px] font-black uppercase tracking-tighter">
                  {getInitials(sub?.agency_name)}
                </span>
              )}
            </div>

            {/* AGENCY & PLAN TEXT */}
            {!isCollapsed && (
              <div className="flex flex-col text-left min-w-0">
                {isLoading ? (
                  <>
                    <Skeleton className="h-3 w-20 mb-1" />
                    <Skeleton className="h-2 w-12" />
                  </>
                ) : (
                  <>
                    <span className="text-sm font-bold truncate">
                      {sub?.agency_name}
                    </span>
                    <span className="text-[11px] font-bold text-primary/60 truncate">
                      {sub?.plan_name} Plan
                    </span>
                  </>
                )}
              </div>
            )}
          </SidebarMenuButton>

          {/* Trigger only visible when expanded on Desktop */}
          {!isCollapsed && !isMobile && (
            <div className="ml-auto shrink-0">
              <SidebarTrigger />
            </div>
          )}
        </SidebarMenuItem>

        {/* Trigger visible below logo when collapsed on Desktop */}
        {isCollapsed && (
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Expand" className="justify-center">
              <div className="mt-2">
                <SidebarTrigger />
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarHeader>
  )
}
