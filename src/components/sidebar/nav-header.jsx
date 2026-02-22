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
import { Layout, ShieldCheck } from 'lucide-react' // Added Layout for fallback icon

// Application Defaults
const APP_NAME = 'Tertiary'
const APP_TAGLINE = 'Development'

export function AppSidebarHeader({ agencySettings }) {
  const { state, isMobile } = useSidebar()
  const { data: sub, isLoading } = useSubscription()

  const isCollapsed = state === 'collapsed' && !isMobile

  // Logic: Check if branding is complete
  // Priority: Props (Real-time updates) > Subscription Query (Fallback)
  const name = agencySettings?.name || agencySettings?.agency_name || sub?.agency_name || APP_NAME
  const logo = agencySettings?.logo_url || sub?.logo_url
  const plan = agencySettings?.tier || sub?.plan_name || APP_TAGLINE
  
  const isBrandingComplete = !!(name && logo && plan && name !== APP_NAME)

  const getInitials = (name) => {
    const finalName = name || APP_NAME
    return finalName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <SidebarHeader className="pt-4 px-2">
      <SidebarMenu>
        <SidebarMenuItem className="flex items-center">
          <SidebarMenuButton
            size="lg"
            className="hover:bg-transparent cursor-default group"
          >
            {/* LOGO SECTION */}
            <div className="flex size-9 items-center justify-center rounded-xl bg-zinc-950 text-white shrink-0 overflow-hidden shadow-sm transition-all duration-500">
              {isLoading ? (
                <Skeleton className="size-full bg-white/10" />
              ) : logo ? (
                <img
                  src={logo}
                  alt={name}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center">
                  {/* If it's the app fallback, show an icon, otherwise initials */}
                  {!name || name === APP_NAME ? (
                    <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold shrink-0">
                      Te
                    </div>
                  ) : (
                    <span className="text-[10px] font-black uppercase tracking-tighter">
                      {getInitials(name)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* IDENTITY TEXT SECTION */}
            {!isCollapsed && (
              <div className="flex flex-col text-left min-w-0 animate-in fade-in slide-in-from-left-2 duration-500">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2 w-16" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="text-sm font-semibold text-foreground truncate tracking-tight">
                        {name}
                      </span>
                      {isBrandingComplete && (
                        <ShieldCheck
                          size={12}
                          className="text-primary shrink-0"
                        />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground truncate">
                      {plan}
                    </span>
                  </>
                )}
              </div>
            )}
          </SidebarMenuButton>

          {/* Trigger: Visible on Desktop when Expanded */}
          {!isCollapsed && !isMobile && (
            <div className="ml-auto shrink-0">
              <SidebarTrigger />
            </div>
          )}
        </SidebarMenuItem>

        {/* Desktop-only: Show trigger below icon when collapsed */}
        {isCollapsed && (
          <SidebarMenuItem className="flex justify-center mt-2">
            <SidebarTrigger />
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarHeader>
  )
}
