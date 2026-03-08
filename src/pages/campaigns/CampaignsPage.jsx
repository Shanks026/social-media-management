import { useHeader } from '@/components/misc/header-context'
import { useSubscription } from '@/api/useSubscription'
import { useCampaigns } from '@/api/campaigns'
import { CampaignTab } from '@/components/campaigns/CampaignTab'
import { CampaignUpgradePrompt } from '@/components/campaigns/CampaignUpgradePrompt'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function CampaignsPage() {
  const { setHeader } = useHeader()
  useEffect(() => {
    setHeader({ title: 'Campaigns', breadcrumbs: [{ label: 'Campaigns' }] })
  }, [setHeader])
  const { data: sub, isLoading: subLoading } = useSubscription()
  const { data: campaigns = [], isLoading: campaignsLoading } = useCampaigns()
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const canCampaigns = sub?.campaigns ?? false
  const campaignCount = campaigns.length

  if (subLoading) return null

  if (!canCampaigns) {
    return (
      <div className="p-6 text-center">
        <CampaignUpgradePrompt />
      </div>
    )
  }

  return (
    <div className="min-h-full bg-background selection:bg-primary/10">
      <div className="px-8 pt-8 pb-20 space-y-8 max-w-[1440px] mx-auto animate-in fade-in duration-700">
        {/* --- SECTION 1: HEADER --- */}
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-light tracking-tight text-foreground">
              Campaigns{' '}
              {!campaignsLoading && campaignCount > 0 && (
                <span className="text-muted-foreground/50 ml-2 font-extralight">
                  {campaignCount}
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground font-light">
              Organize and track your content initiatives across all your social
              channels.
            </p>
          </div>

          <Button onClick={() => setIsCreateOpen(true)} className="gap-2 h-9">
            <Plus size={16} />
            New Campaign
          </Button>
        </div>

        {/* --- SECTION 2: THE CONTENT --- */}
        <CampaignTab
          isCreateOpen={isCreateOpen}
          setIsCreateOpen={setIsCreateOpen}
        />
      </div>
    </div>
  )
}
