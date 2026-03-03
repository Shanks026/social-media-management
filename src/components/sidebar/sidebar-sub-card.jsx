// src/components/sidebar/sidebar-sub-card.jsx
import { Zap, Database, Users } from 'lucide-react'
import { useSidebar } from '@/components/ui/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigate } from 'react-router-dom'
import { useSubscription } from '../../api/useSubscription'
import { cn } from '@/lib/utils'

export function SidebarSubCard() {
  const navigate = useNavigate()
  const { state } = useSidebar()
  const { data: sub, isLoading } = useSubscription()

  // Hide entirely if sidebar is collapsed
  if (state === 'collapsed') return null
  if (isLoading || !sub) return null

  // 1. Logic for Conditional Visibility
  const clientLimit = sub.max_clients
  const currentClients = sub.client_count
  const storagePercent = sub.storage_display.percent

  const clientPercent = (currentClients / clientLimit) * 100

  const isFreeTier = sub.plan_name?.toUpperCase() === 'FREE'
  const isClientReached = currentClients >= clientLimit
  const isClientNearing = clientPercent >= 80 && clientPercent < 100

  const isStorageReached = storagePercent >= 100
  const isStorageNearing = storagePercent >= 80 && storagePercent < 100

  // 2. The Trigger: Only show if nearing or reached any limit
  const shouldShow =
    isClientReached || isClientNearing || isStorageReached || isStorageNearing

  if (!shouldShow) return null

  // Helper for Free Tier subtle messaging
  const getBadgeContent = () => {
    // Storage reached is always a "Limit reached" hard alarm
    if (isStorageReached)
      return {
        text: 'Limit reached',
        className: 'text-red-600 border-red-500/20 bg-red-500/5',
        dot: 'bg-red-600',
      }

    // For Free tier clients reached, we don't return a badge content here anymore
    // It will be handled as a separate sentence below.
    if (isFreeTier && isClientReached) return null

    if (isClientReached)
      return {
        text: 'Limit reached',
        className: 'text-red-600 border-red-500/20 bg-red-500/5',
        dot: 'bg-red-600',
      }
    if (isStorageNearing || isClientNearing)
      return {
        text: 'Nearing limit',
        className: 'text-amber-600 border-amber-500/20 bg-amber-500/5',
        dot: 'bg-amber-500',
      }
    return null
  }

  const badge = getBadgeContent()

  /**
   * Helper to get status colors based on thresholds
   */
  const getStatusClasses = (percent, isCountLimit = false) => {
    if (percent >= 100 || isCountLimit) {
      // Muted amber for free tier client reach, professional red for others/storage
      if (isFreeTier && !isStorageReached)
        return {
          text: 'text-amber-600/80',
          bg: 'bg-amber-500',
          indicator: 'bg-amber-500',
        }
      return { text: 'text-red-600', bg: 'bg-red-600', indicator: 'bg-red-600' }
    }
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
    <div className="px-3">
      <Card className="shadow-none border-muted bg-muted/50 py-0 gap-0 overflow-hidden">
        <CardHeader className="p-4 pb-2 space-y-2">
          <div className="flex flex-col gap-2 items-start">
            <div className="flex justify-between items-center w-full">
              <CardTitle className="text-[11px] font-bold flex items-center gap-2 uppercase tracking-widest text-primary">
                <Zap className="size-3 fill-primary text-primary" />
                {sub.plan_name} Plan
              </CardTitle>
              {badge && (
                <Badge
                  variant="outline"
                  className={cn(
                    'py-0.5 px-2 text-[9px] font-medium transition-colors',
                    badge.className,
                  )}
                >
                  <span className="relative flex h-1.5 w-1.5 me-1">
                    {badge.text === 'Limit reached' && (
                      <span
                        className={cn(
                          'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                          badge.dot.replace('bg-', 'bg-') + '/40',
                        )}
                      ></span>
                    )}
                    <span
                      className={cn(
                        'relative inline-flex rounded-full h-1.5 w-1.5',
                        badge.dot,
                      )}
                    ></span>
                  </span>
                  {badge.text}
                </Badge>
              )}
            </div>

            {isFreeTier && isClientReached && !isStorageReached && (
              <p className="text-[10.5px] text-muted-foreground leading-relaxed font-light">
                You've utilized your free tier benefits. Upgrade to add more
                clients.
              </p>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-0 space-y-4">
          <div className="space-y-4">
            {/* Client Usage */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                  <Users size={12} /> Clients
                </span>
                <span className={clientStatus.text}>
                  {currentClients} / {clientLimit}
                </span>
              </div>
              {!isFreeTier && (
                <Progress
                  value={(currentClients / clientLimit) * 100}
                  className="h-1"
                  indicatorClassName={clientStatus.indicator}
                />
              )}
            </div>

            {/* Storage Usage */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Database size={12} /> Storage
                </span>
                <span className={storageStatus.text}>
                  {sub.storage_display.usage_value}{' '}
                  {sub.storage_display.usage_unit} /{' '}
                  {sub.storage_display.max_value} {sub.storage_display.max_unit}
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
            onClick={() => navigate('/billing?tab=subscription&scroll=true')}
          >
            Upgrade
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
