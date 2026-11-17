import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useHeader } from '../../components/misc/header-context'
import { useSubscription } from '../../api/useSubscription'
import { BarChart3, CreditCard } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UsageTab } from './UsageTab'
import { SubscriptionTab } from './TertiarySubscriptionTab'

// --- Main Page ---

export default function BillingUsage() {
  const { setHeader } = useHeader()
  const { data: sub, isLoading } = useSubscription()
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab = searchParams.get('tab') || 'usage'

  const handleTabChange = (value) => {
    setSearchParams({ tab: value }, { replace: true })
  }

  useEffect(() => {
    setHeader({
      title: 'Billing & Usage',
      breadcrumbs: [
        { label: 'Settings', href: '/settings' },
        { label: 'Billing & Usage' },
      ],
    })
  }, [setHeader])

  return (
    <div className="h-full bg-background overflow-y-auto overflow-x-hidden selection:bg-primary/10 [scrollbar-gutter:stable]">
      <div className="overflow-hidden">
        <div className="px-8 pt-8 pb-20 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-700 fill-mode-both">
          {/* PAGE HEADER */}
          <div className="space-y-1">
            <h1 className="text-3xl font-normal tracking-tight text-foreground bricolage">
              Billing & Usage
            </h1>
            <p className="text-sm text-muted-foreground font-normal">
              Monitor your plan usage and manage your subscription.
            </p>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="space-y-10"
          >
            <TabsList variant="underline">
              {[
                { value: 'usage', icon: BarChart3, label: 'Usage' },
                { value: 'subscription', icon: CreditCard, label: 'Subscription' },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                >
                  <tab.icon className="size-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── Tab 1: Usage ── */}
            <TabsContent
              value="usage"
              className="space-y-8 focus-visible:outline-none outline-none"
            >
              <UsageTab sub={sub} isLoading={isLoading} />
            </TabsContent>

            {/* ── Tab 2: Subscription ── */}
            <TabsContent
              value="subscription"
              className="space-y-8 focus-visible:outline-none outline-none"
            >
              <SubscriptionTab sub={sub} isLoading={isLoading} />
            </TabsContent>

          </Tabs>
        </div>
      </div>
    </div>
  )
}
