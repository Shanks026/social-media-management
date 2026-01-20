import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ModeToggle } from "./mode-toggle";
import { useHeader } from "./header-context";

export function AppHeader() {
  const { header } = useHeader();

  return (
    <header className="flex h-16 items-center px-8 border-b w-full">
      <div className="flex flex-col gap-1">
        {header.breadcrumbs?.length > 0 && (
          <Breadcrumb>
            <BreadcrumbList>
              {header.breadcrumbs.map((crumb, index) => {
                const isLast = index === header.breadcrumbs.length - 1;

                return (
                  <BreadcrumbItem key={index}>
                    {crumb.href && !isLast ? (
                      <BreadcrumbLink href={crumb.href}>
                        {crumb.label}
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    )}

                    {!isLast && <BreadcrumbSeparator />}
                  </BreadcrumbItem>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        )}

       
      </div>

      <div className="ml-auto flex items-center gap-2">
        {header.actions}
        <ModeToggle />
      </div>
    </header>
  );
}
