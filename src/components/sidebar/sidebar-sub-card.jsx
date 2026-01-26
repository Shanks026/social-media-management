import { Zap } from 'lucide-react'
import { useSidebar } from '@/components/ui/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'

export function SidebarSubCard() {
  const { state } = useSidebar()

  // Hide the card entirely when sidebar is collapsed
  if (state === 'collapsed') return null

  const used = 8
  const total = 20
  const percentage = (used / total) * 100

  // Only show the upgrade button if usage is 80% or higher
  const showUpgradeButton = percentage >= 80

  return (
    <div className="px-3">
      <Card className="shadow-none border-muted bg-muted/50 !pt-4 gap-2 py-0">
        <CardHeader className="p-4 py-0">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Zap className="size-3.5 fill-primary text-primary" />
            Agency Pro
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Manage up to <strong>{total} clients</strong> with your current
            plan. Scale as you grow.
          </p>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-medium">
              <span className="font-light text-muted-foreground">Client limit usage</span>
              <span>
                {used} / {total}
              </span>
            </div>
            <Progress value={percentage} className="h-1.5" />
          </div>

          {showUpgradeButton && (
            <Button
              size="sm"
              className="w-full h-8 text-xs font-semibold mt-1"
              variant="default"
            >
              Upgrade Plan
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
