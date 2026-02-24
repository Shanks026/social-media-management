// components/TierBadge.jsx
import { Crown, Zap } from 'lucide-react'

const TierBadge = ({ tier }) => {
  if (!tier) return null

  const normalizedTier = tier.toUpperCase()
  const baseStyles =
    'inline-flex items-center justify-center py-0.5 px-1.5 rounded-md shrink-0 shadow-md font-bold tracking-wider uppercase ms-2'

  if (normalizedTier === 'INTERNAL') {
    return (
      <div>
        {/* Replacing Crown with verify.svg from public folder */}
        <img 
          src="/verify.png" 
          alt="Verified" 
          className="size-4.5 ms-1" 
        />
      </div>
    )
  }

  if (normalizedTier === 'VIP') {
    return (
      <div className={`${baseStyles} bg-purple-600 text-white`}>
        <Crown className="size-3 fill-current mr-1" />
        <span className="text-[10px]">VIP</span>
      </div>
    )
  }

  if (normalizedTier === 'PRO') {
    return (
      <div className={`${baseStyles} bg-amber-400 text-amber-950`}>
        <Zap className="size-3 fill-current mr-1" />
        <span className="text-[10px]">PRO</span>
      </div>
    )
  }

  return null
}

export default TierBadge