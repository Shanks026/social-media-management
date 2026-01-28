import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchClientById } from '../../api/clients'
import { useHeader } from '@/components/misc/header-context'

// UI Components
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  LayoutGrid,
  Calendar,
  Settings2,
  BarChart3,
  Crown,
  Zap,
} from 'lucide-react'

// Extracted Tabs
import WorkflowTab from './clientSections/WorkflowTab'
import ManagementTab from './clientSections/ManagementTab'
import { ComingSoon } from './clientSections/ComingSoon'

const TABS_CONFIG = [
  { value: 'workflow', label: 'Workflow', icon: LayoutGrid },
  { value: 'calendar', label: 'Calendar', icon: Calendar },
  { value: 'insights', label: 'Insights', icon: BarChart3 },
  { value: 'management', label: 'Management', icon: Settings2 },
]

export default function ClientDetails() {
  const { clientId } = useParams()
  const { setHeader } = useHeader()

  const {
    data: client,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => fetchClientById(clientId),
    enabled: !!clientId,
  })

  useEffect(() => {
    if (client) {
      setHeader({
        title: client.name,
        breadcrumbs: [
          { label: 'Clients', href: '/clients' },
          { label: client.name },
        ],
      })
    }
  }, [client, setHeader])

  if (isLoading)
    return <div className="p-8 animate-pulse">Loading profile...</div>
  if (error || !client)
    return <div className="p-8 text-destructive">Error loading client.</div>

  // Logic from ClientCard.jsx
  const tier = client.tier?.toUpperCase() || 'BASIC'
  const industry = client.industry || 'Food and Eatables'

  console.log(client.industry, 'INDUS')
  const initials = client.name
    ? client.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'CL'

  const renderTierBadge = () => {
    if (tier === 'VIP')
      return (
        <div className="flex items-center justify-center size-5 rounded-md bg-purple-600 text-white shrink-0 shadow-sm">
          <Crown className="size-2.5 fill-current" />
        </div>
      )
    if (tier === 'PRO')
      return (
        <div className="flex items-center justify-center size-5 rounded-md bg-amber-400 text-amber-950 shrink-0 shadow-sm">
          <Zap className="size-2.5 fill-current" />
        </div>
      )
    return null
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-8 pt-8 pb-4 space-y-7">
        {/* Compact Sub-Header */}
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 shrink-0 rounded-xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 flex items-center justify-center overflow-hidden shadow-sm">
            {client.logo_url ? (
              <img
                src={client.logo_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-gray-100 dark:bg-zinc-800 text-gray-400 font-bold text-base">
                {initials}
              </div>
            )}
          </div>

          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
                {client.name}
              </h1>
              {renderTierBadge()}
            </div>
            <p className="text-xs font-medium text-muted-foreground truncate">
              {industry}
            </p>
          </div>
        </div>

        {/* Minimalist Tabs */}
        <Tabs defaultValue="workflow" className="w-full gap-0">
          {/* TabsList: 
            - justify-start keeps them to the left
            - w-full ensures the border-b spans the container
        */}
          <TabsList className="bg-transparent h-auto w-full justify-start rounded-none p-0 gap-12 border-b shadow-none border-gray-100 dark:border-white/10">
            {TABS_CONFIG.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="
        relative rounded-none bg-transparent px-0 pb-3 pt-0 text-sm font-medium transition-none 
        shadow-none border-b-2 border-transparent text-muted-foreground

        flex-none w-fit
        
        /* Active State Background Fixes */
        data-[state=active]:bg-transparent 
        dark:data-[state=active]:bg-transparent
        
        /* Hardcoded Active Text: Pure Black (Light) / Pure White (Dark) */
        data-[state=active]:text-black 
        dark:data-[state=active]:text-white 
        
        /* Hardcoded Active Border: Pure Black (Light) / Pure White (Dark) */
        data-[state=active]:border-black
        dark:data-[state=active]:border-white
        
        data-[state=active]:shadow-none
        
        /* Force remove any side/top borders from the base component */
        data-[state=active]:border-x-0 
        data-[state=active]:border-t-0
        focus-visible:ring-0
      "
              >
                <tab.icon className="size-4 mr-2" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent
            value="workflow"
            className="mt-6 focus-visible:ring-0 outline-none"
          >
            <WorkflowTab client={client} />
          </TabsContent>

          <TabsContent value="calendar" className="focus-visible:outline-none">
            <ComingSoon icon={Calendar} title="Content Calendar" />
          </TabsContent>

          <TabsContent value="insights" className="focus-visible:outline-none">
            <ComingSoon icon={BarChart3} title="Performance Insights" />
          </TabsContent>

          <TabsContent
            value="management"
            className="mt-6 focus-visible:outline-none"
          >
            <ManagementTab client={client} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
