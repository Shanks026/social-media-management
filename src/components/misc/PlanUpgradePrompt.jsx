import { Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

// Generic inline "you don't have this on your plan" block — replaces a page's
// (or a nested route's) content area entirely, rather than a dialog: arriving
// at a whole page/section you can't use reads better as an in-place
// explanation than a dismissible popup. Use ProposalsUpgradePrompt-style
// dialogs instead when an *action* is interrupted mid-task (e.g. hitting a
// count limit) — this is for landing on a destination you don't have access
// to at all.
export function PlanUpgradePrompt({ title, description }) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="p-3 rounded-full bg-muted">
        <Lock className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => navigate('/billing')}>
        View Plans
      </Button>
    </div>
  )
}
