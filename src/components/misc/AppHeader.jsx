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
import { SidebarTrigger } from '@/components/ui/sidebar' // Import the trigger

export function AppHeader() {
  const { header } = useHeader()

  return (
    <header className="flex h-16 items-center px-4 md:px-8 border-b w-full bg-background">
      {/* --- MOBILE LOGO SECTION --- */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold">
          Te
        </div>
        <span className="text-sm font-bold">Tertiary</span>
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
