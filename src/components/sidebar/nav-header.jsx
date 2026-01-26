import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'

export function AppSidebarHeader() {
  const { state, isMobile } = useSidebar()

  // This ensures we only hide things if we are on Desktop AND Collapsed
  const isCollapsed = state === 'collapsed' && !isMobile

  return (
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem className="flex items-center">
          <SidebarMenuButton size="lg">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold shrink-0">
              Te
            </div>

            {/* FIX: Only show text if NOT collapsed OR if on mobile */}
            {!isCollapsed && (
              <div className="flex flex-col text-left min-w-0">
                <span className="text-sm font-bold truncate">Tertiary</span>
                <span className="text-xs text-muted-foreground truncate">
                  Development
                </span>
              </div>
            )}
          </SidebarMenuButton>

          {/* Internal trigger: Only on Desktop + Expanded */}
          {!isCollapsed && !isMobile && (
            <div className="ml-auto shrink-0">
              <SidebarTrigger />
            </div>
          )}
        </SidebarMenuItem>

        {/* Desktop-only: Show trigger below icon when collapsed */}
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
