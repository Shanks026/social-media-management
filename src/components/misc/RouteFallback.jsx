import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Shared Suspense fallback for lazy-loaded route pages. Used at every
// boundary (top-level public/full-page routes, the AppShell outlet, and the
// Finance outlet) so a page that is still downloading never shows as blank.
export function RouteFallback({ className }) {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className={cn(
        'flex min-h-[60vh] w-full items-center justify-center bg-background',
        className,
      )}
    >
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  )
}
