import { useHeader } from '@/components/misc/header-context'
import { useSubscription } from '@/api/useSubscription'
import { useCampaigns } from '@/api/campaigns'
import { usePermissions } from '@/api/usePermissions'
import { CampaignTab } from '@/components/campaigns/CampaignTab'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Plus } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function CampaignsPage() {
  const { setHeader } = useHeader()
  useEffect(() => {
    setHeader({ title: 'Campaigns', breadcrumbs: [{ label: 'Campaigns' }] })
  }, [setHeader])
  const { data: sub, isLoading: subLoading } = useSubscription()
  const { data: campaigns = [], isLoading: campaignsLoading } = useCampaigns()
  const { canCreateCampaigns } = usePermissions()
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const campaignCount = campaigns.length
  const campaignsLimit = sub?.campaigns_limit ?? null
  const atLimit = campaignsLimit !== null && campaignCount >= campaignsLimit

  if (subLoading) return null

  return (
    <div className="min-h-full bg-background selection:bg-primary/10">
      <div className="px-8 pt-8 pb-20 space-y-8 max-w-[1400px] mx-auto animate-page-fade-in">
        {/* --- SECTION 1: HEADER --- */}
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-normal tracking-tight text-foreground bricolage">
              Campaigns{' '}
              {!campaignsLoading && campaignCount > 0 && (
                <span className="text-muted-foreground/50 ml-2 font-extralight">
                  {campaignCount}
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground font-normal">
              Organize and track your content initiatives across all your social
              channels.
            </p>
          </div>

          {canCreateCampaigns && (
            <div className="flex items-center gap-3">
              {campaignsLimit !== null && !campaignsLoading && (
                <span className="text-xs text-muted-foreground">
                  {campaignCount} / {campaignsLimit} campaigns
                </span>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      onClick={() => !atLimit && setIsCreateOpen(true)}
                      className="gap-2 h-9"
                      disabled={atLimit}
                    >
                      <Plus size={16} />
                      New Campaign
                    </Button>
                  </span>
                </TooltipTrigger>
                {atLimit && (
                  <TooltipContent>
                    Campaign limit reached. Upgrade to Velocity for unlimited campaigns.
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          )}
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
