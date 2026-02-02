import { useEffect, useState } from 'react'
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ComingSoon = ({ icon: Icon, title }) => (
  <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed rounded-2xl bg-muted/5 mt-6">
    <div className="size-12 rounded-full bg-background flex items-center justify-center border shadow-sm mb-4">
      <Icon className="size-6 text-muted-foreground" />
    </div>
    <h3 className="text-sm font-semibold">{title}</h3>
    <p className="text-xs text-muted-foreground mt-1 text-center max-w-[200px]">
      This feature is currently in development.
    </p>
  </div>
)

export default function Settings() {
  const { setHeader } = useHeader()
  const { data: sub, isLoading } = useSubscription()

  useEffect(() => {
    setHeader({
      title: 'Settings',
      breadcrumbs: [{ label: 'Settings', href: '/settings' }],
    })
  }, [setHeader])

  const formatStorage = (bytes) => {
    const mb = bytes / (1024 * 1024)
    if (mb < 1024) return `${mb.toFixed(1)} MB`
    const gb = mb / 1024
    return `${gb.toFixed(1)} GB`
  }

  /**
   * Helper to determine status colors based on percentage
   * < 80%: Neutral/Primary
   * 80% - 99%: Warning (Orange)
   * 100%+: Critical (Red)
   */
  const getStatusConfig = (percent) => {
    if (percent >= 100)
      return {
        text: 'text-red-600 dark:text-red-400',
        progress: 'bg-red-600 dark:bg-red-500',
        border: 'border-red-200 dark:border-red-900/50',
        bg: 'bg-red-50/50 dark:bg-red-950/20',
      }
    if (percent >= 80)
      return {
        text: 'text-orange-500 dark:text-orange-400',
        progress: 'bg-orange-500 dark:bg-orange-400',
        border: 'border-orange-200 dark:border-orange-900/50',
        bg: 'bg-orange-50/50 dark:bg-orange-950/20',
      }
    return {
      text: 'text-primary',
      progress: 'bg-primary',
      border: 'border-border',
      bg: 'bg-card',
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account, subscription, and usage metrics.
        </p>
      </div>

      <Tabs defaultValue="subscription" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="profile" className="gap-2">
            <User className="size-4" /> My Profile
          </TabsTrigger>
          <TabsTrigger value="subscription" className="gap-2">
            <CreditCard className="size-4" /> Subscription
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <SettingsIcon className="size-4" /> Preferences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ComingSoon icon={User} title="Profile Management" />
        </TabsContent>

        <TabsContent value="subscription" className="space-y-6">
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-44 bg-muted animate-pulse rounded-xl"
                />
              ))}
            </div>
          ) : sub ? (
            <>
              {/* Plan Overview Card */}
              <Card className="border-primary/10 bg-gradient-to-br from-background to-muted/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-bold flex items-center gap-2">
                      <Zap className="size-5 fill-primary text-primary" />
                      {sub.plan_name} Plan
                    </CardTitle>
                    <CardDescription>
                      Your workspace is currently on the{' '}
                      <span className="font-bold text-foreground">
                        {sub.plan_name}
                      </span>{' '}
                      tier.
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() =>
                      window.open(
                        'mailto:support@yourdomain.com?subject=Upgrade Plan Request',
                      )
                    }
                    className="gap-2"
                  >
                    <ArrowUpCircle className="size-4" />
                    Upgrade Plan
                  </Button>
                </CardHeader>
              </Card>

              {/* KPI Grid */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Client Usage KPI Card */}
                {(() => {
                  const percent = (sub.client_count / sub.max_clients) * 100
                  const status = getStatusConfig(percent)
                  return (
                    <Card
                      className={cn(
                        'transition-colors duration-300',
                        status.border,
                        status.bg,
                      )}
                    >
                      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          Client Slots
                        </CardTitle>
                        <Users className={cn('size-4', status.text)} />
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-baseline justify-between">
                          <div className="flex items-baseline gap-1">
                            <span
                              className={cn(
                                'text-4xl font-black tracking-tighter',
                                status.text,
                              )}
                            >
                              {sub.client_count}
                            </span>
                            <span className="text-sm font-medium text-muted-foreground">
                              / {sub.max_clients} used
                            </span>
                          </div>
                          {percent >= 80 && (
                            <AlertTriangle
                              className={cn(
                                'size-5 animate-pulse',
                                status.text,
                              )}
                            />
                          )}
                        </div>
                        <div className="space-y-2">
                          <Progress
                            value={percent}
                            className="h-2 bg-muted/50"
                            indicatorClassName={status.progress}
                          />
                          <div className="flex justify-between items-center">
                            <p className="text-[11px] font-bold uppercase tracking-tight text-muted-foreground">
                              {sub.max_clients - sub.client_count} slots
                              available
                            </p>
                            <p
                              className={cn(
                                'text-[11px] font-black',
                                status.text,
                              )}
                            >
                              {percent.toFixed(0)}%
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })()}

                {/* Storage Usage KPI Card */}
                {(() => {
                  const percent = sub.storage_display.percent
                  const status = getStatusConfig(percent)
                  return (
                    <Card
                      className={cn(
                        'transition-colors duration-300',
                        status.border,
                        status.bg,
                      )}
                    >
                      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          Storage Capacity
                        </CardTitle>
                        <Database className={cn('size-4', status.text)} />
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-baseline justify-between">
                          <div className="flex items-baseline gap-1">
                            <span
                              className={cn(
                                'text-4xl font-black tracking-tighter',
                                status.text,
                              )}
                            >
                              {
                                formatStorage(sub.storage_used_bytes).split(
                                  ' ',
                                )[0]
                              }
                            </span>
                            <span className="text-sm font-medium text-muted-foreground uppercase">
                              {
                                formatStorage(sub.storage_used_bytes).split(
                                  ' ',
                                )[1]
                              }{' '}
                              of {formatStorage(sub.storage_max_bytes)}
                            </span>
                          </div>
                          {percent >= 80 && (
                            <AlertTriangle
                              className={cn(
                                'size-5 animate-pulse',
                                status.text,
                              )}
                            />
                          )}
                        </div>
                        <div className="space-y-2">
                          <Progress
                            value={percent}
                            className="h-2 bg-muted/50"
                            indicatorClassName={status.progress}
                          />
                          <div className="flex justify-between items-center">
                            <p className="text-[11px] font-bold uppercase tracking-tight text-muted-foreground">
                              {formatStorage(
                                sub.storage_max_bytes - sub.storage_used_bytes,
                              )}{' '}
                              remaining
                            </p>
                            <p
                              className={cn(
                                'text-[11px] font-black',
                                status.text,
                              )}
                            >
                              {percent.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })()}
              </div>

              {/* Trust Badge */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
                <ShieldCheck className="size-5 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your subscription is managed by the platform administrator.
                  For immediate billing inquiries, upgrades, or to request
                  higher storage limits, please
                  <a
                    href="mailto:support@yourdomain.com"
                    className="ml-1 text-primary font-bold hover:underline"
                  >
                    contact support
                  </a>
                  .
                </p>
              </div>
            </>
          ) : (
            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="py-10 text-center">
                <p className="text-sm font-medium text-destructive">
                  No active subscription found. Please contact the administrator
                  to assign a plan to your account.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="preferences">
          <ComingSoon icon={SettingsIcon} title="Workspace Preferences" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
