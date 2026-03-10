import { useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function ProposalsUpgradePrompt({ open, onOpenChange, limit = 5 }) {
  const navigate = useNavigate()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="size-5 text-primary" />
            Proposal Limit Reached
          </DialogTitle>
          <DialogDescription>
            You've used all {limit} proposals on your current plan. Upgrade to
            Velocity for unlimited proposals and access to more powerful features.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false)
              navigate('/billing')
            }}
          >
            Upgrade Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
