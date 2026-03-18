// components/TierBadge.jsx
import { Crown, Zap } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const TierBadge = ({ tier }) => {
  if (!tier) return null

  const normalizedTier = tier.toUpperCase()

  if (normalizedTier === 'INTERNAL') {
    return (
      <img
        src="/verify.png"
        alt="Verified"
        className="size-4.5 ms-1 shrink-0"
      />
    )
  }

  if (normalizedTier === 'VIP') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Crown className="size-4 fill-current text-purple-500 shrink-0 ms-1" />
        </TooltipTrigger>
        <TooltipContent>VIP</TooltipContent>
      </Tooltip>
    )
  }

  if (normalizedTier === 'PRO') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Zap className="size-4 fill-current text-amber-400 shrink-0 ms-1" />
        </TooltipTrigger>
        <TooltipContent>PRO</TooltipContent>
      </Tooltip>
    )
  }

  return null
}

export default TierBadge