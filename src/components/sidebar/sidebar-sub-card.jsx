import { Zap, Database, Users, Loader2 } from 'lucide-react'
import { useSidebar } from '@/components/ui/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { useSubscription } from '../../api/useSubscription'
import { cn } from '@/lib/utils'

export function SidebarSubCard() {
  const { state } = useSidebar()
  const { data: sub, isLoading } = useSubscription()

  // Hide the card entirely when sidebar is collapsed
  if (state === 'collapsed') return null

  // Show a mini skeleton while loading
  if (isLoading) {
    return (
      <div className="px-3">
        <div className="h-24 w-full bg-muted/50 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (!sub) return null

  /**
   * Formats bytes to MB or GB dynamically
   * Uses MB for values < 1024MB, otherwise uses GB
   */
  const formatStorage = (bytes) => {
    const mb = bytes / (1024 * 1024)
    if (mb < 1024) {
      return `${mb.toFixed(1)} MB`
    }
    const gb = mb / 1024
    return `${gb.toFixed(1)} GB`
  }

  // Usage Math
  const clientPercent = (sub.client_count / sub.max_clients) * 100
  const storagePercent = sub.storage_display.percent
  const showUpgradeButton = clientPercent >= 80 || storagePercent >= 80

  return (
    <div className="px-3">
      <Card className="shadow-none border-muted bg-muted/50 !pt-4 gap-2 py-0">
        <CardHeader className="p-4 py-0">
          <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-wide text-foreground/90">
            <Zap className="size-3.5 fill-primary text-primary" />
            {sub.plan_name} Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Manage up to <strong>{sub.max_clients} clients</strong>. Scale as
            you grow.
          </p>

          <div className="space-y-3">
            {/* Client Usage */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-medium">
                <span className="font-light text-muted-foreground flex items-center gap-1">
                  <Users size={10} /> Clients
                </span>
                <span
                  className={cn(
                    sub.is_client_limit_reached && 'text-destructive font-bold',
                  )}
                >
                  {sub.client_count} / {sub.max_clients}
                </span>
              </div>
              <Progress
                value={clientPercent}
                className="h-1.5"
                indicatorClassName={
                  sub.is_client_limit_reached ? 'bg-destructive' : ''
                }
              />
            </div>

            {/* Storage Usage - Dynamically formatted */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-medium">
                <span className="font-light text-muted-foreground flex items-center gap-1">
                  <Database size={10} /> Storage
                </span>
                <span
                  className={cn(
                    storagePercent >= 100 && 'text-destructive font-bold',
                  )}
                >
                  {formatStorage(sub.storage_used_bytes)} /{' '}
                  {formatStorage(sub.storage_max_bytes)}
                </span>
              </div>
              <Progress
                value={storagePercent}
                className="h-1.5"
                indicatorClassName={
                  storagePercent >= 100 ? 'bg-destructive' : ''
                }
              />
            </div>
          </div>

          {showUpgradeButton && (
            <Button
              size="sm"
              className="w-full h-8 text-xs font-semibold mt-1 shadow-sm"
              variant="default"
              onClick={() =>
                window.open(
                  'mailto:support@yourdomain.com?subject=Upgrade Plan Request',
                )
              }
            >
              Upgrade Plan
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
