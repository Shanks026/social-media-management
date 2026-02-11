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
} from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ComingSoon } from './clients/clientSections/ComingSoon'

// --- Sub-Components (Clean Organization Style) ---

const UsageCard = ({
  title,
  icon: Icon,
  value,
  max,
  unit,
  percent,
  status,
}) => (
  <Card
    className={cn(
      'border border-border/50 bg-card/30 shadow-sm rounded-2xl overflow-hidden transition-all',
      status.border,
    )}
  >
    <CardContent className="p-7 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          {title}
        </p>
        <div className={cn('p-2 rounded-xl bg-muted/50', status.text)}>
          <Icon className="size-4" />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline gap-2">
          <span
            className={cn('text-4xl font-light tracking-tight', status.text)}
          >
            {value}
          </span>
          <span className="text-sm font-light text-muted-foreground/60">
            / {max} {unit}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <Progress
          value={percent}
          className="h-1.5 bg-muted rounded-full"
          indicatorClassName={cn('rounded-full', status.progress)}
        />
        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
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
  <Card className="border border-border/50 bg-card/30 rounded-2xl overflow-hidden">
    <div className="p-8 lg:p-10 flex flex-col md:flex-row md:items-center justify-between gap-10">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 text-primary">
          <Zap className="size-7" fill="currentColor" />
        </div>

        <div className="space-y-2 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/5 border border-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wider">
            <Zap size={12} fill="currentColor" /> {sub.plan_name} active
          </div>
          <h2 className="text-3xl font-light tracking-tight">
            {sub.plan_name}{' '}
            <span className="font-normal italic">Subscription.</span>
          </h2>
          <p className="text-muted-foreground text-sm font-light leading-relaxed max-w-md">
            Your agency is currently on the {sub.plan_name} tier. You have
            access to all core client management and post versioning features.
          </p>
        </div>
      </div>

      <Button
        size="lg"
        className="h-12 px-8 rounded-full font-medium text-sm shadow-lg shadow-primary/5 transition-all gap-2"
        onClick={() => window.open('mailto:support@yourdomain.com')}
      >
        Upgrade Plan <ArrowUpCircle size={18} />
      </Button>
    </div>
  </Card>
)

// --- Main Settings Page ---

export default function Settings() {
  const { setHeader } = useHeader()
  const { data: sub, isLoading } = useSubscription()

  useEffect(() => {
    setHeader({
      title: 'Settings',
      breadcrumbs: [{ label: 'Settings' }],
    })
  }, [setHeader])

  const formatStorageValue = (bytes) => {
    const mb = bytes / (1024 * 1024)
    return mb < 1024 ? mb.toFixed(1) : (mb / 1024).toFixed(1)
  }

  const getStatusConfig = (percent) => {
    if (percent >= 100)
      return {
        text: 'text-destructive',
        progress: 'bg-destructive',
        border: 'border-l-4 border-l-destructive',
      }
    if (percent >= 80)
      return {
        text: 'text-amber-500',
        progress: 'bg-amber-500',
        border: 'border-l-4 border-l-amber-500',
      }
    return {
      text: 'text-primary',
      progress: 'bg-primary',
      border: 'border-none',
    }
  }

  return (
    <div className="h-full bg-background overflow-y-auto overflow-x-hidden selection:bg-primary/10 [scrollbar-gutter:stable]">
      {/* WRAPPER: 'overflow-hidden' here prevents the slide-in animation from 
          temporarily increasing the page height and triggering the scrollbar.
      */}
      <div className="overflow-hidden">
        <div className="px-8 pt-8 pb-20 space-y-8 max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
          {/* PAGE HEADER */}
          <div className="space-y-1">
            <h1 className="text-3xl font-light tracking-tight text-foreground">
              Settings
            </h1>
            <p className="text-sm text-muted-foreground font-light">
              Configure your workspace and monitor subscription usage.
            </p>
          </div>

          <Tabs defaultValue="subscription" className="space-y-10">
            <TabsList className="bg-transparent border-b border-white/5 rounded-none p-0 h-auto gap-8 w-full justify-start">
              {[
                { value: 'profile', icon: User, label: 'My Profile' },
                {
                  value: 'subscription',
                  icon: CreditCard,
                  label: 'Subscription',
                },
                {
                  value: 'preferences',
                  icon: SettingsIcon,
                  label: 'Preferences',
                },
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
              className="space-y-8 focus-visible:outline-none outline-none"
            >
              {isLoading ? (
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="h-44 bg-muted/40 animate-pulse rounded-2xl col-span-2" />
                  <div className="h-44 bg-muted/40 animate-pulse rounded-2xl" />
                  <div className="h-44 bg-muted/40 animate-pulse rounded-2xl" />
                </div>
              ) : sub ? (
                <div className="space-y-8">
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
                      unit={
                        sub.storage_max_bytes / (1024 * 1024) < 1024
                          ? 'MB'
                          : 'GB'
                      }
                      percent={sub.storage_display.percent}
                      status={getStatusConfig(sub.storage_display.percent)}
                    />
                  </div>

                  <div className="flex items-center gap-4 p-5 rounded-2xl bg-secondary/20 border border-border/40">
                    <ShieldCheck className="size-4 text-muted-foreground" />
                    <p className="text-[13px] text-muted-foreground font-light">
                      Workspace managed by administrator. For higher limits,{' '}
                      <a
                        href="mailto:support@domain.com"
                        className="text-primary hover:underline font-medium"
                      >
                        contact support
                      </a>
                      .
                    </p>
                  </div>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent
              value="profile"
              className="pt-4 focus-visible:outline-none"
            >
              <ComingSoon icon={User} title="Profile Settings" />
            </TabsContent>

            <TabsContent
              value="preferences"
              className="pt-4 focus-visible:outline-none"
            >
              <ComingSoon icon={SettingsIcon} title="Workspace Preferences" />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
