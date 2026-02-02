// src/components/sidebar/sidebar-sub-card.jsx
import { Zap, Database, Users } from 'lucide-react'
import { useSidebar } from '@/components/ui/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSubscription } from '../../api/useSubscription'
import { cn } from '@/lib/utils'

export function SidebarSubCard() {
  const { state } = useSidebar()
  const { data: sub, isLoading } = useSubscription()

  // Hide entirely if sidebar is collapsed
  if (state === 'collapsed') return null
  if (isLoading || !sub) return null

  // 1. Logic for Conditional Visibility
  const clientLimit = sub.max_clients
  const currentClients = sub.client_count
  const storagePercent = sub.storage_display.percent

  const isClientReached = currentClients >= clientLimit
  const isClientNearing = currentClients === clientLimit - 1

  const isStorageReached = storagePercent >= 100
  const isStorageNearing = storagePercent >= 80 && storagePercent < 100

  // 2. The Trigger: Only show if nearing or reached any limit
  const shouldShow =
    isClientReached || isClientNearing || isStorageReached || isStorageNearing

  if (!shouldShow) return null

  /**
   * Helper to format storage bytes
   */
  const formatStorage = (bytes) => {
    const mb = bytes / (1024 * 1024)
    if (mb < 1024) return `${mb.toFixed(1)} MB`
    return `${(mb / 1024).toFixed(1)} GB`
  }

  /**
   * Helper to get status colors based on thresholds
   */
  const getStatusClasses = (percent, isCountLimit = false) => {
    if (percent >= 100 || isCountLimit)
      return { text: 'text-red-600', bg: 'bg-red-600', indicator: 'bg-red-600' }
    if (percent >= 80)
      return {
        text: 'text-orange-500',
        bg: 'bg-orange-500',
        indicator: 'bg-orange-500',
      }
    return {
      text: 'text-muted-foreground',
      bg: 'bg-primary',
      indicator: 'bg-primary',
    }
  }

  const clientStatus = getStatusClasses(
    (currentClients / clientLimit) * 100,
    isClientReached,
  )
  const storageStatus = getStatusClasses(storagePercent)

  return (
    <div className="px-3 py-4">
      <Card className="shadow-none border-muted bg-muted/50 py-0 gap-0 overflow-hidden">
        <CardHeader className="p-4 pb-2 space-y-3">
          <div className="flex flex-col gap-3 items-start">
            {isClientReached || isStorageReached ? (
              <Badge
                variant="outline"
                className=" text-red-600 py-1 text-[10px]"
              >
                <span className="relative flex h-2 w-2 me-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                </span>
                Limit reached
              </Badge>
            ) : (
              (isClientNearing || isStorageNearing) && (
                <Badge
                  variant="outline"
                  className="text-amber-600 py-1 text-[10px]"
                >
                  <span className="inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  Nearing limit
                </Badge>
              )
            )}
            <CardTitle className="text-[11px] font-bold flex items-center gap-2 uppercase tracking-widest text-primary">
              <Zap className="size-3 fill-primary text-primary" />
              {sub.plan_name} Plan
            </CardTitle>

            {/* Status Badges */}
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-0 space-y-4">
          <div className="space-y-4">
            {/* Client Usage */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Users size={12} /> Clients
                </span>
                <span className={clientStatus.text}>
                  {currentClients} / {clientLimit}
                </span>
              </div>
              <Progress
                value={(currentClients / clientLimit) * 100}
                className="h-1"
                indicatorClassName={clientStatus.indicator}
              />
            </div>

            {/* Storage Usage */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Database size={12} /> Storage
                </span>
                <span className={storageStatus.text}>
                  {formatStorage(sub.storage_used_bytes)} /{' '}
                  {formatStorage(sub.storage_max_bytes)}
                </span>
              </div>
              <Progress
                value={storagePercent}
                className="h-1"
                indicatorClassName={storageStatus.indicator}
              />
            </div>
          </div>

          <Button
            size="sm"
            className="w-full h-8 text-[11px] font-bold mt-2 shadow-sm uppercase tracking-wider"
            variant="default"
            onClick={() =>
              window.open(
                'mailto:support@yourdomain.com?subject=Upgrade Plan Request',
              )
            }
          >
            Manage
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
