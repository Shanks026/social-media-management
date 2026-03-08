import { useHeader } from '@/components/misc/header-context'
import { useSubscription } from '@/api/useSubscription'
import { CampaignTab } from '@/components/campaigns/CampaignTab'
import { CampaignUpgradePrompt } from '@/components/campaigns/CampaignUpgradePrompt'

export default function CampaignsPage() {
  useHeader({ title: 'Campaigns', breadcrumbs: [{ label: 'Campaigns' }] })
  const { data: sub } = useSubscription()
  const canCampaigns = sub?.campaigns ?? false

  return (
    <div className="p-6">
      {canCampaigns ? <CampaignTab /> : <CampaignUpgradePrompt />}
    </div>
  )
}
