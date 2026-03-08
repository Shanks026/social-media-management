import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  LayoutGrid,
  Calendar,
  Settings2,
  PieChart,
  Receipt,
  FolderOpen,
  Megaphone,
} from 'lucide-react'

// UI Components
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import TierBadge from '@/components/TierBadge'

// Section Imports
import OverviewTab from './clientSections/OverviewTab'
import WorkflowTab from './clientSections/WorkflowTab'
import ManagementTab from './clientSections/ManagementTab'
import IndustryBadge from './IndustryBadge'
import ContentCalendar from '../calendar/ContentCalendar'
import { cn } from '@/lib/utils'
import { ClientBillingTab } from './ClientBillingTab'
import DocumentsTab from '@/components/documents/DocumentsTab'
import { CampaignTab } from '@/components/campaigns/CampaignTab'

export default function ClientProfileView({ client }) {
  if (!client) return null

  const initials = client.name
    ? client.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'CL'

  const [searchParams, setSearchParams] = useSearchParams()

  // Get active tab from URL or default to 'overview'
  const activeTab = searchParams.get('tab') || 'overview'

  const handleTabChange = (value) => {
    setSearchParams(
      (prev) => {
        prev.set('tab', value)
        return prev
      },
      { replace: true },
    )
  }

  // Build tabs — Billing only shows for external (non-internal) clients
  const TABS_CONFIG = [
    { value: 'overview', label: 'Overview', icon: PieChart },
    { value: 'workflow', label: 'Workflow', icon: LayoutGrid },
    ...(!client.is_internal
      ? [{ value: 'billing', label: 'Billing', icon: Receipt }]
      : []),
    { value: 'campaigns', label: 'Campaigns', icon: Megaphone },
    { value: 'documents', label: 'Documents', icon: FolderOpen },
    { value: 'calendar', label: 'Calendar', icon: Calendar },
    { value: 'management', label: 'Settings', icon: Settings2 },
  ]

  return (
    <div className="min-h-full bg-background selection:bg-primary/10">
      {/* MAIN CONTAINER: Standardised to max-w-[1440px] to match the Clients List Page */}
      <div className="px-8 pt-6 pb-10 space-y-6 max-w-[1440px] mx-auto animate-in fade-in duration-700">
        {/* --- HEADER SECTION --- */}
        <div className="flex items-center gap-6">
          <div className="h-16 w-16 shrink-0 rounded-2xl bg-muted/20 border border-border/40 flex items-center justify-center overflow-hidden shadow-sm transition-transform hover:scale-[1.02]">
            {client.logo_url ? (
              <img
                src={client.logo_url}
                alt={client.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-muted text-muted-foreground/60 font-bold text-xl tracking-tighter">
                {initials}
              </div>
            )}
          </div>

          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <h1 className="text-2xl font-medium tracking-normal text-foreground truncate">
                {client.name}
              </h1>
              <TierBadge tier={client.tier} />
            </div>
            <div className="flex items-center gap-2">
              <IndustryBadge industryValue={client.industry} />
            </div>
          </div>
        </div>

        {/* --- NAVIGATION & CONTENT --- */}
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          {/* Tab List */}
          <TabsList className="bg-transparent h-auto w-full justify-start rounded-none p-0 gap-12 border-b border-border/40">
            {TABS_CONFIG.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="
                  relative rounded-none bg-transparent px-0 pb-3 pt-0 text-sm font-medium transition-none 
                  shadow-none border-b-2 border-transparent text-muted-foreground
                  flex-none w-fit
                  data-[state=active]:bg-transparent 
                  dark:data-[state=active]:bg-transparent
                  data-[state=active]:text-black 
                  dark:data-[state=active]:text-white 
                  data-[state=active]:border-black
                  dark:data-[state=active]:border-white
                  data-[state=active]:shadow-none
                  data-[state=active]:border-x-0 
                  data-[state=active]:border-t-0
                  focus-visible:ring-0
                "
              >
                <tab.icon className={cn('size-4 transition-colors')} />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tab Content */}
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <TabsContent
              value="overview"
              className="mt-2 focus-visible:ring-0 outline-none"
            >
              <OverviewTab client={client} />
            </TabsContent>

            <TabsContent
              value="workflow"
              className="mt-2 focus-visible:ring-0 outline-none"
            >
              <WorkflowTab client={client} />
            </TabsContent>

            {!client.is_internal && (
              <TabsContent
                value="billing"
                className="mt-2 focus-visible:outline-none"
              >
                <ClientBillingTab clientId={client.id} />
              </TabsContent>
            )}

            <TabsContent
              value="campaigns"
              className="mt-2 focus-visible:outline-none"
            >
              <CampaignTab clientId={client.id} />
            </TabsContent>

            <TabsContent
              value="documents"
              className="mt-2 focus-visible:outline-none"
            >
              <DocumentsTab clientId={client.id} />
            </TabsContent>

            <TabsContent
              value="calendar"
              className="focus-visible:outline-none"
            >
              <div className="mt-2">
                <ContentCalendar clientId={client.id} hideHeader={true} />
              </div>
            </TabsContent>

            <TabsContent
              value="management"
              className="mt-2 focus-visible:outline-none"
            >
              <ManagementTab client={client} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
