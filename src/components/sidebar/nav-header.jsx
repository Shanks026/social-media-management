import { useSubscription } from '@/api/useSubscription'
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { Layout } from 'lucide-react'

// Application Defaults
const APP_NAME = 'Tercero'
const APP_TAGLINE = 'Development'
const DEFAULT_ICON = '/TerceroLogo2.svg' // Path to your public folder icon

export function AppSidebarHeader({ agencySettings }) {
  const { state, isMobile } = useSidebar()
  const { data: sub, isLoading } = useSubscription()

  const isCollapsed = state === 'collapsed' && !isMobile

  const name =
    agencySettings?.name ||
    agencySettings?.agency_name ||
    sub?.agency_name ||
    APP_NAME
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
            <div
              className={`flex shrink-0 items-center justify-center transition-all duration-300 overflow-hidden rounded-lg shadow-sm bg-background ${
                isCollapsed ? 'size-8' : 'size-9'
              }`}
            >
              {isLoading ? (
                <Skeleton className="size-full rounded-lg" />
              ) : logo ? (
                <img
                  src={logo}
                  alt={name}
                  className="size-full object-cover rounded-lg"
                  onError={(e) => {
                    e.target.onerror = null
                    e.target.src = DEFAULT_ICON
                  }}
                />
              ) : name === APP_NAME || !name ? (
                <img
                  src={DEFAULT_ICON}
                  alt="Tercero Logo"
                  className="size-full object-contain transition-all duration-300"
                />
              ) : (
                <div className="flex size-full items-center justify-center bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-lg">
                  <span className="text-[10px] font-black uppercase tracking-tighter">
                    {getInitials(name)}
                  </span>
                </div>
              )}
            </div>

            {/* IDENTITY TEXT SECTION */}
            {/* Fix: Kept in DOM. Used max-w and opacity for a smooth, flicker-free transition */}
            <div
              className={`flex flex-col text-left overflow-hidden transition-all duration-300 ease-in-out ${
                isCollapsed
                  ? 'max-w-0 opacity-0 ml-0'
                  : 'max-w-[200px] opacity-100 ml-0'
              }`}
            >
              {isLoading ? (
                <div className="space-y-2 w-24">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2 w-16" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className="text-sm font-semibold text-foreground truncate tracking-tight">
                      {name}
                    </span>
                    {isBrandingComplete && (
                      <img
                        src="/verify.png"
                        alt="Verified"
                        className="size-3.5 shrink-0"
                      />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground truncate">
                    {plan}
                  </span>
                </>
              )}
            </div>
          </SidebarMenuButton>

          {/* Trigger: Visible on Desktop when Expanded */}
          {/* Fix: Kept in DOM to prevent layout pop */}
          <div
            className={`shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
              isCollapsed || isMobile
                ? 'max-w-0 opacity-0 ml-0'
                : 'max-w-[32px] opacity-100 ml-auto'
            }`}
          >
            <SidebarTrigger />
          </div>
        </SidebarMenuItem>

        {/* Desktop-only: Show trigger below icon when collapsed */}
        {/* Fix: Wrapped in an animating div to slide down smoothly instead of instantly appearing */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isCollapsed && !isMobile
              ? 'max-h-[40px] opacity-100 mt-2'
              : 'max-h-0 opacity-0 mt-0'
          }`}
        >
          <SidebarMenuItem className="flex justify-center">
            <SidebarTrigger />
          </SidebarMenuItem>
        </div>
      </SidebarMenu>
    </SidebarHeader>
  )
}
