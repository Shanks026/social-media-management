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
import { useNavigate } from 'react-router-dom'

// Application Defaults
const APP_NAME = 'Tercero'
const APP_TAGLINE = 'Development'
const DEFAULT_ICON = '/TerceroIcon.svg'
const LANDSCAPE_LOGO = '/TerceroLand.svg'

export function AppSidebarHeader({ agencySettings }) {
  const { state, isMobile } = useSidebar()
  const { data: sub, isLoading } = useSubscription()
  const navigate = useNavigate()

  const isCollapsed = state === 'collapsed' && !isMobile

  const name =
    agencySettings?.name ||
    agencySettings?.agency_name ||
    sub?.agency_name ||
    APP_NAME
  const logo = agencySettings?.logo_url || sub?.logo_url
  const plan = agencySettings?.tier || sub?.plan_name || APP_TAGLINE

  // Use the feature flag — not the name — to decide if agency branding is shown
  const showAgencyBranding = sub?.branding_agency_sidebar ?? false
  const isBrandingComplete = !!(showAgencyBranding && name && logo && plan && name !== APP_NAME)

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
    <SidebarHeader className="px-2">
      <SidebarMenu>
        <SidebarMenuItem className="flex items-center">
          <SidebarMenuButton
            size={isCollapsed ? 'default' : 'lg'}
            className={`hover:bg-transparent cursor-pointer group ${
              isCollapsed ? 'justify-center p-0 w-full' : 'justify-start'
            }`}
            onClick={() => navigate('/dashboard')}
          >
            {/* LOGO SECTION */}
            <div
              className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg ${
                !showAgencyBranding
                  ? isCollapsed
                    ? 'size-7'
                    : 'h-9 w-32 ml-[-4px]'
                  : `shadow-sm bg-background ${isCollapsed ? 'size-6' : 'size-9'}`
              }`}
            >
              {isLoading ? (
                <Skeleton className="size-full rounded-lg" />
              ) : !showAgencyBranding ? (
                // Ignite: always show Tercero logo regardless of any agency logo set
                <div
                  className={`${isCollapsed ? 'size-5' : 'h-7 w-28'} bg-foreground`}
                  style={{
                    maskImage: `url(${isCollapsed ? DEFAULT_ICON : LANDSCAPE_LOGO})`,
                    maskRepeat: 'no-repeat',
                    maskPosition: 'center',
                    maskSize: 'contain',
                    WebkitMaskImage: `url(${isCollapsed ? DEFAULT_ICON : LANDSCAPE_LOGO})`,
                    WebkitMaskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    WebkitMaskSize: 'contain',
                  }}
                />
              ) : logo ? (
                // Velocity / Quantum with logo set
                <img
                  src={logo}
                  alt={name}
                  className="size-full object-cover rounded-lg"
                  onError={(e) => {
                    const parent = e.target.parentElement
                    if (parent) {
                      const fallback = document.createElement('div')
                      fallback.className = 'size-6 bg-foreground'
                      fallback.style.maskImage = `url(${DEFAULT_ICON})`
                      fallback.style.maskRepeat = 'no-repeat'
                      fallback.style.maskPosition = 'center'
                      fallback.style.maskSize = 'contain'
                      fallback.style.webkitMaskImage = `url(${DEFAULT_ICON})`
                      fallback.style.webkitMaskRepeat = 'no-repeat'
                      fallback.style.webkitMaskPosition = 'center'
                      fallback.style.webkitMaskSize = 'contain'
                      parent.innerHTML = ''
                      parent.appendChild(fallback)
                    }
                  }}
                />
              ) : (
                // Velocity / Quantum without logo — show initials
                <div className="flex size-full items-center justify-center bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-lg">
                  <span className="text-[10px] font-black uppercase tracking-tighter">
                    {getInitials(name)}
                  </span>
                </div>
              )}
            </div>

            {/* IDENTITY TEXT — only rendered when expanded and non-Tercero branding */}
            {!isCollapsed && !!showAgencyBranding && (
              <div className="flex flex-col text-left overflow-hidden ml-2">
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
            )}
          </SidebarMenuButton>

          {/* Collapse trigger — only rendered when expanded on desktop */}
          {!isCollapsed && !isMobile && (
            <SidebarTrigger className="ml-auto shrink-0" />
          )}
        </SidebarMenuItem>

        {/* Expand trigger — only rendered when collapsed on desktop */}
        {isCollapsed && !isMobile && (
          <SidebarMenuItem className="flex justify-center mt-2">
            <SidebarTrigger />
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarHeader>
  )
}
