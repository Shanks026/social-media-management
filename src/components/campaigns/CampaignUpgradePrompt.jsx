import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

export function CampaignUpgradePrompt() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="p-3 rounded-full bg-muted">
        <Lock className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold text-foreground">
          Campaigns are a Velocity feature
        </p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Group posts into named campaigns, track progress, and manage client
          deliverables — available on Velocity and above.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => navigate('/billing')}>
        View Plans
      </Button>
    </div>
  )
}
