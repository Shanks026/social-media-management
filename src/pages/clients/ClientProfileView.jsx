import { useEffect } from 'react'
import { LayoutGrid, Calendar, Settings2, BarChart3 } from 'lucide-react'

// UI Components
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import TierBadge from '@/components/TierBadge'

// Section Imports
import WorkflowTab from './clientSections/WorkflowTab'
import ManagementTab from './clientSections/ManagementTab'
import { ComingSoon } from './clientSections/ComingSoon'
import IndustryBadge from './IndustryBadge'
import ContentCalendar from '../calendar/ContentCalendar'
import { cn } from '@/lib/utils'

const TABS_CONFIG = [
  { value: 'workflow', label: 'Workflow', icon: LayoutGrid },
  { value: 'calendar', label: 'Calendar', icon: Calendar },
  { value: 'insights', label: 'Insights', icon: BarChart3 },
  { value: 'management', label: 'Settings', icon: Settings2 },
]

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

  return (
    <div className="min-h-full bg-background selection:bg-primary/10">
      {/* MAIN CONTAINER: 
          Standardised to max-w-[1400px] to match the Clients List Page 
      */}
      <div className="px-8 pt-10 pb-20 space-y-10 max-w-[1400px] mx-auto animate-in fade-in duration-700">
        {/* --- HEADER SECTION: Google-esque Lightweight Typography --- */}
        <div className="flex items-center gap-6">
          <div className="h-16 w-16 shrink-0 rounded-[22px] bg-muted/20 border border-border/40 flex items-center justify-center overflow-hidden shadow-sm transition-transform hover:scale-[1.02]">
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
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-light tracking-tight text-foreground truncate">
                {client.name}
              </h1>
              <TierBadge tier={client.tier} />
            </div>
            <div className="flex items-center gap-2">
              <IndustryBadge industryValue={client.industry} />
              <span className="text-[10px] text-muted-foreground/30">•</span>
              <span className="text-xs text-muted-foreground font-light tracking-wide italic">
                Active Client Workspace
              </span>
            </div>
          </div>
        </div>

        {/* --- NAVIGATION & CONTENT --- */}
        <Tabs defaultValue="workflow" className="w-full">
          {/* Tab List: Clean, border-bottom navigation */}
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
          {/* Tab Content: Spaced and Animated */}
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <TabsContent
              value="workflow"
              className="mt-8 focus-visible:ring-0 outline-none"
            >
              <WorkflowTab client={client} />
            </TabsContent>

            <TabsContent
              value="calendar"
              className="focus-visible:outline-none"
            >
              <div className="mt-8">
                <ContentCalendar clientId={client.id} hideHeader={true} />
              </div>
            </TabsContent>

            <TabsContent
              value="insights"
              className="focus-visible:outline-none"
            >
              <div className="mt-12">
                <ComingSoon icon={BarChart3} title="Performance Insights" />
              </div>
            </TabsContent>

            <TabsContent
              value="management"
              className="mt-8 focus-visible:outline-none"
            >
              <ManagementTab client={client} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
