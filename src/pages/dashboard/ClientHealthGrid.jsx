import { useQuery } from '@tanstack/react-query'
import { isBefore, formatDistanceToNow } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { fetchClients } from '@/api/clients'
import { ArrowUpRight, UserStar } from 'lucide-react'
import { Button } from '@/components/ui/button'

function getHealthStatus(client) {
  const { drafts, pending, revisions, scheduled, next_post_at } =
    client.pipeline
  const inPipeline = drafts + pending + revisions + scheduled

  if (scheduled > 0) return 'healthy'

  const nextPostPast =
    !next_post_at || isBefore(new Date(next_post_at), new Date())
  if (inPipeline === 0 && nextPostPast) return 'at-risk'

  return 'attention'
}

const HEALTH_CONFIG = {
  healthy: {
    label: 'Healthy',
    dotClass: 'bg-emerald-500',
    labelClass: 'text-emerald-700 dark:text-emerald-400',
  },
  attention: {
    label: 'Needs Attention',
    dotClass: 'bg-yellow-500',
    labelClass: 'text-yellow-700 dark:text-yellow-400',
  },
  'at-risk': {
    label: 'At Risk',
    dotClass: 'bg-destructive',
    labelClass: 'text-destructive',
  },
}

export default function ClientHealthGrid() {
  const navigate = useNavigate()
  const { data: clientsData, isLoading } = useQuery({
    queryKey: ['clients-pipeline-dashboard'],
    queryFn: () => fetchClients(),
    staleTime: 30000,
  })

  const realClients = (clientsData?.clients ?? []).filter((c) => !c.is_internal)

  return (
    <Card className="border-none shadow-sm ring-1 gap-2 ring-border/50 bg-card/50 dark:bg-card/30">
      <CardHeader className="shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              Client Content Health
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Content status across all active clients
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 -mr-2 text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/clients')}
          >
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : realClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-8 gap-2">
            <div className="h-10 w-10 border border-dashed rounded-full flex items-center justify-center text-muted-foreground">
              <UserStar className="h-4 w-4" />
            </div>
            <p className="text-sm text-muted-foreground">No clients yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-2">
            {realClients.map((client) => {
              const health = getHealthStatus(client)
              const config = HEALTH_CONFIG[health]
              const { drafts, pending, revisions, scheduled, next_post_at } =
                client.pipeline
              const inPipeline = drafts + pending + revisions + scheduled

              return (
                <button
                  key={client.id}
                  className="flex flex-col items-start gap-3 rounded-xl border bg-card/40 p-4 text-left shadow-sm ring-1 ring-border/50 hover:bg-accent/50 hover:ring-border transition-all duration-200 w-full group overflow-hidden"
                  onClick={() => navigate(`/clients/${client.id}`)}
                >
                  <div className="flex items-center gap-3 w-full min-w-0">
                    <Avatar className="size-9 shrink-0 ring-2 ring-background shadow-sm transition-transform group-hover:scale-105">
                      <AvatarImage src={client.logo_url} alt={client.name} />
                      <AvatarFallback className="text-xs font-semibold bg-primary/5 text-primary">
                        {client.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-semibold truncate text-foreground/90 group-hover:text-foreground transition-colors">
                        {client.name}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div
                          className={cn(
                            'size-1.5 rounded-full shrink-0 shadow-sm',
                            config.dotClass,
                          )}
                        />
                        <span
                          className={cn(
                            'text-[10px] font-bold tracking-wider uppercase',
                            config.labelClass,
                          )}
                        >
                          {config.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full h-px bg-border/40 my-1 relative">
                    <div className="absolute inset-y-0 left-0 w-1/4 bg-linear-to-r from-border/80 to-transparent" />
                  </div>

                  <div className="text-[13px] text-muted-foreground w-full space-y-2 pt-1">
                    <div className="flex items-center justify-between w-full">
                      <span className="text-muted-foreground/70 text-xs">
                        Pipeline
                      </span>
                      <span className="font-semibold text-foreground/80 bg-muted/50 px-2 py-0.5 rounded-md border border-border/40 shadow-sm text-xs">
                        {inPipeline} post{inPipeline !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {next_post_at ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-muted-foreground/70 text-xs">
                          Next Drop
                        </span>
                        <span className="font-medium text-foreground/70 truncate text-right text-xs">
                          {formatDistanceToNow(new Date(next_post_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full opacity-70">
                        <span className="text-muted-foreground/70 text-xs">
                          Next Drop
                        </span>
                        <span className="text-xs">-</span>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
