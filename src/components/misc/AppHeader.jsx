import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { ModeToggle } from './mode-toggle'
import { useHeader } from './header-context'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useSubscription } from '@/api/useSubscription'

const APP_NAME = 'Tercero'
const DEFAULT_ICON = '/TerceroIcon.svg'

const getInitials = (name) =>
  (name || APP_NAME)
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

export function AppHeader({ agencySettings }) {
  const { header } = useHeader()
  const { data: sub } = useSubscription()

  const name =
    agencySettings?.name ||
    agencySettings?.agency_name ||
    sub?.agency_name ||
    APP_NAME
  const logo = agencySettings?.logo_url || sub?.logo_url
  const isTercero = name === APP_NAME || !name

  return (
    <header className="flex h-16 items-center px-4 md:px-8 border-b w-full bg-background">
      {/* --- MOBILE LOGO SECTION --- */}
      <div className="flex items-center md:hidden">
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg ${
            isTercero ? 'size-7' : 'size-8 shadow-sm bg-background'
          }`}
        >
          {logo ? (
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
          ) : isTercero ? (
            <div
              className="size-5 bg-foreground"
              style={{
                maskImage: `url(${DEFAULT_ICON})`,
                maskRepeat: 'no-repeat',
                maskPosition: 'center',
                maskSize: 'contain',
                WebkitMaskImage: `url(${DEFAULT_ICON})`,
                WebkitMaskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                WebkitMaskSize: 'contain',
              }}
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-lg">
              <span className="text-[10px] font-black uppercase tracking-tighter">
                {getInitials(name)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* --- DESKTOP BREADCRUMBS SECTION --- */}
      <div className="hidden md:flex flex-col gap-1">
        {header.breadcrumbs?.length > 0 && (
          <Breadcrumb>
            <BreadcrumbList className="font-normal">
              {header.breadcrumbs.map((crumb, index) => {
                const isLast = index === header.breadcrumbs.length - 1

                return (
                  <BreadcrumbItem key={index}>
                    {crumb.href && !isLast ? (
                      <BreadcrumbLink href={crumb.href}>
                        {crumb.label}
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="font-medium">
                        {crumb.label}
                      </BreadcrumbPage>
                    )}
                    {!isLast && <BreadcrumbSeparator />}
                  </BreadcrumbItem>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        )}
      </div>

      {/* --- RIGHT ACTIONS SECTION --- */}
      <div className="ml-auto flex items-center gap-2">
        {header.actions}
        <ModeToggle />

        {/* --- MOBILE SIDEBAR TRIGGER --- */}
        <div className="md:hidden ml-2">
          <SidebarTrigger />
        </div>
      </div>
    </header>
  )
}
