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
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/helper'
import { useUrgentClients } from '@/api/clients'

function TrialStatusPill({ phase, daysRemaining, endsAt }) {
  const navigate = useNavigate()

  const colorClass = {
    active:   'bg-muted text-muted-foreground hover:bg-muted/80',
    warning:  'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:hover:bg-amber-900',
    critical: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900',
    grace:    'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900',
  }[phase] ?? 'bg-muted text-muted-foreground'

  const endDateStr = endsAt ? formatDate(endsAt) : null

  let desktopText
  let mobileText
  if (phase === 'grace') {
    desktopText = 'Trial expired · Grace Period'
    mobileText = 'Trial exp.'
  } else if (phase === 'critical' && daysRemaining === 0) {
    desktopText = 'Trial · expires today'
    mobileText = 'Exp. today'
  } else if (phase === 'critical' && daysRemaining === 1) {
    desktopText = 'Trial · expires tomorrow'
    mobileText = 'Exp. tmrw'
  } else {
    desktopText = `Trial · ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left`
    mobileText = `${daysRemaining}d left`
  }

  return (
    <button
      onClick={() => navigate('/billing')}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer border-0 outline-none focus-visible:ring-2 focus-visible:ring-ring',
        colorClass,
      )}
    >
      <span className="hidden sm:inline">{desktopText}</span>
      <span className="sm:hidden">{mobileText}</span>
      {endDateStr && (
        <span className="hidden sm:inline opacity-60">· {endDateStr}</span>
      )}
    </button>
  )
}

function UrgencyAlertIndicator() {
  const navigate = useNavigate()
  const { data: urgentClients = [] } = useUrgentClients()

  if (urgentClients.length === 0) return null

  const overdueCount = urgentClients.filter((c) => {
    const diff = (new Date(c.next_post_at) - new Date()) / (1000 * 60 * 60)
    return diff < 0
  }).length
  const urgentCount = urgentClients.length - overdueCount

  const parts = []
  if (urgentCount > 0) parts.push(`${urgentCount} urgent`)
  if (overdueCount > 0) parts.push(`${overdueCount} overdue`)
  const summary = parts.join(' and ')

  return (
    <div className="flex items-center gap-2 text-destructive me-2">
      {/* Pulsating dot */}
      <span className="relative flex size-2 shrink-0">
        <span className="animate-ping absolute inline-flex size-full rounded-full bg-rose-500 opacity-75" />
        <span className="relative inline-flex rounded-full size-2 bg-destructive" />
      </span>
      {/* Sentence — hidden on small screens */}
      <p className="hidden lg:block text-sm font-medium whitespace-nowrap">
        You have {summary} deliverable{urgentClients.length !== 1 ? 's' : ''}.{' '}
        <button
          onClick={() => navigate('/clients')}
          className="underline underline-offset-2 font-semibold hover:opacity-70 transition-opacity cursor-pointer"
        >
          Take action
        </button>
      </p>
    </div>
  )
}

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
    <header className="sticky top-0 z-50 flex shrink-0 h-16 items-center px-4 md:px-8 border-b w-full bg-background/80 backdrop-blur-md">
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
        {sub?.trial_phase && (
          <TrialStatusPill phase={sub.trial_phase} daysRemaining={sub.trial_days_remaining} endsAt={sub.trial_ends_at} />
        )}
        {header.actions}
        <UrgencyAlertIndicator />
        <ModeToggle />

        {/* --- MOBILE SIDEBAR TRIGGER --- */}
        <div className="md:hidden ml-2">
          <SidebarTrigger />
        </div>
      </div>
    </header>
  )
}
