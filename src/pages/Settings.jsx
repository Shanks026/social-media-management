import { useEffect } from 'react'
import { useHeader } from '../components/misc/header-context'
import { useSubscription } from '../api/useSubscription'
import {
  User,
  Zap,
  Settings as SettingsIcon,
  Database,
  Users,
  ShieldCheck,
  ArrowUpCircle,
  CreditCard,
  AlertTriangle,
} from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ComingSoon } from './clients/clientSections/ComingSoon'

// --- Sub-Components (Internal for Cleanliness) ---

const UsageCard = ({
  title,
  icon: Icon,
  value,
  max,
  unit,
  percent,
  status,
}) => (
  <Card className={cn('border-none bg-card/50 shadow-sm', status.border)}>
    <CardContent className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
          {title}
        </p>
        <Icon className={cn('size-4', status.text)} />
      </div>

      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span
            className={cn('text-3xl font-black tracking-tight', status.text)}
          >
            {value}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            / {max} {unit} used
          </span>
        </div>
        {percent >= 80 && (
          <AlertTriangle className={cn('size-4 animate-pulse', status.text)} />
        )}
      </div>

      <div className="space-y-2">
        <Progress
          value={percent}
          className="h-1.5 bg-muted/50"
          indicatorClassName={status.progress}
        />
        <div className="flex justify-between text-[10px] font-bold uppercase tracking-tighter text-muted-foreground/70">
          <span>
            {max - value} {unit} remaining
          </span>
          <span className={status.text}>{percent.toFixed(0)}%</span>
        </div>
      </div>
    </CardContent>
  </Card>
)

const PlanOverview = ({ sub }) => (
  <Card className="border-none bg-gradient-to-br from-card/80 to-muted/30 shadow-sm overflow-hidden relative">
    <div className="absolute top-0 right-0 p-8 opacity-5">
      <Zap className="size-24 fill-primary text-primary" />
    </div>
    <CardContent className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Zap className="size-5 fill-primary text-primary" />
          <h2 className="text-2xl font-black tracking-tight">
            {sub.plan_name} Plan
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Workspace tier:{' '}
          <span className="font-bold text-foreground">{sub.plan_name}</span>
        </p>
        <div className="flex items-center gap-1.5 mt-2 px-2 py-1 bg-primary/10 rounded-md w-fit border border-primary/10">
          <ShieldCheck className="size-3 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
            Agency Workspace is Free
          </span>
        </div>
      </div>
      <Button
        variant="outline"
        className="gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all font-bold text-xs uppercase tracking-widest"
        onClick={() => window.open('mailto:support@yourdomain.com')}
      >
        <ArrowUpCircle className="size-3.5" />
        Upgrade Plan
      </Button>
    </CardContent>
  </Card>
)

// --- Main Settings Page ---

export default function Settings() {
  const { setHeader } = useHeader()
  const { data: sub, isLoading } = useSubscription()

  useEffect(() => {
    setHeader({
      title: 'Settings',
      breadcrumbs: [{ label: 'Settings', href: '/settings' }],
    })
  }, [setHeader])

  const formatStorageValue = (bytes) => {
    const mb = bytes / (1024 * 1024)
    return mb < 1024 ? mb.toFixed(1) : (mb / 1024).toFixed(1)
  }

  const getStorageUnit = (bytes) => (bytes / (1024 * 1024) < 1024 ? 'MB' : 'GB')

  const getStatusConfig = (percent) => {
    if (percent >= 100)
      return {
        text: 'text-red-500',
        progress: 'bg-red-500',
        border: 'border-l-4 border-l-red-500',
      }
    if (percent >= 80)
      return {
        text: 'text-orange-500',
        progress: 'bg-orange-500',
        border: 'border-l-4 border-l-orange-500',
      }
    return {
      text: 'text-primary',
      progress: 'bg-primary',
      border: 'border-none',
    }
  }

  return (
    <div className="p-10 max-w-[80vw] mx-auto space-y-10 animate-in fade-in duration-500">
      <header className="space-y-1">
        <h1 className="text-3xl font-black tracking-tighter">Settings</h1>
        <p className="text-sm text-muted-foreground/80">
          Configure your workspace and monitor subscription usage.
        </p>
      </header>

      <Tabs defaultValue="subscription" className="space-y-8">
        <TabsList className="bg-transparent border-b border-white/5 rounded-none p-0 h-auto gap-8 w-full justify-start">
          {[
            { value: 'profile', icon: User, label: 'My Profile' },
            { value: 'subscription', icon: CreditCard, label: 'Subscription' },
            { value: 'preferences', icon: SettingsIcon, label: 'Preferences' },
          ].map((tab) => (
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
              <tab.icon className="size-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent
          value="subscription"
          className="space-y-8 focus-visible:outline-none"
        >
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="h-44 bg-muted animate-pulse rounded-2xl col-span-2" />
              <div className="h-44 bg-muted animate-pulse rounded-2xl" />
              <div className="h-44 bg-muted animate-pulse rounded-2xl" />
            </div>
          ) : sub ? (
            <>
              <PlanOverview sub={sub} />

              <div className="grid gap-6 md:grid-cols-2">
                <UsageCard
                  title="Client Capacity"
                  icon={Users}
                  value={sub.client_count}
                  max={sub.max_clients}
                  unit="slots"
                  percent={(sub.client_count / sub.max_clients) * 100}
                  status={getStatusConfig(
                    (sub.client_count / sub.max_clients) * 100,
                  )}
                />

                <UsageCard
                  title="Storage Limit"
                  icon={Database}
                  value={formatStorageValue(sub.storage_used_bytes)}
                  max={formatStorageValue(sub.storage_max_bytes)}
                  unit={getStorageUnit(sub.storage_max_bytes)}
                  percent={sub.storage_display.percent}
                  status={getStatusConfig(sub.storage_display.percent)}
                />
              </div>

              <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/30 border border-white/5">
                <ShieldCheck className="size-4 text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground leading-relaxed uppercase tracking-wider font-bold">
                  Managed by administrator. For upgrades or higher limits,
                  <a
                    href="mailto:support@domain.com"
                    className="ml-1 text-primary hover:underline"
                  >
                    contact support
                  </a>
                  .
                </p>
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="profile" className="focus-visible:outline-none">
          <ComingSoon icon={User} title="Profile Settings" />
        </TabsContent>

        <TabsContent value="preferences" className="focus-visible:outline-none">
          <ComingSoon icon={SettingsIcon} title="Workspace Preferences" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
