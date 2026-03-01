import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { format, isToday, isTomorrow, differenceInDays } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { Send, ArrowUpRight } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

import { useGlobalPosts } from '@/api/useGlobalPosts'

function PostReleaseItem({ post, clientsMap }) {
  const navigate = useNavigate()
  const postDate = new Date(post.target_date || post.created_at)
  let dateLabel = format(postDate, 'MMM d, yyyy')
  let variant = 'outline'

  if (isToday(postDate)) {
    dateLabel = 'Today'
    variant = 'default'
  } else if (isTomorrow(postDate)) {
    dateLabel = 'Tomorrow'
    variant = 'secondary'
  } else {
    const days = differenceInDays(postDate, new Date())
    if (days >= 0 && days < 7) {
      dateLabel = `In ${days} Days`
      variant = 'secondary'
    } else if (days < 0) {
       dateLabel = 'Overdue'
       variant = 'destructive'
    }
  }

  const client = clientsMap[post.client_id]

  return (
    <div className="hover:bg-background/80 transition-colors border-b border-dashed pb-4 mb-4 last:mb-0 last:pb-0 last:border-0">
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 pr-4">
          <p className="font-medium text-sm truncate line-clamp-1">
            {post.content || 'No content...'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <Send className="h-3 w-3" />
            {format(postDate, 'h:mm a')}
            {client && (
              <>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span className="truncate max-w-[120px]">{client.name}</span>
              </>
            )}
          </p>
        </div>
        <Badge variant={variant} className="text-[10px] px-1.5 py-0 h-5 shrink-0">
          {dateLabel}
        </Badge>
      </div>
      <div className="flex items-center gap-2 mt-3 text-xs">
         <div className="flex flex-wrap gap-1 flex-1">
            {(post.platforms || []).map(p => (
               <Badge key={p} variant="secondary" className="text-[9px] px-1 py-0 h-4">
                  {p}
               </Badge>
            ))}
         </div>
         <Button
           variant="outline"
           size="sm"
           className="h-7 text-xs shrink-0"
           onClick={() => navigate(`/clients/${post.client_id}`)}
         >
           View Post
         </Button>
      </div>
    </div>
  )
}

export default function DashboardScheduledPosts() {
  const navigate = useNavigate()

  // 1. Clients Map
  const { data: clientsMap = {} } = useQuery({
    queryKey: ['clients-map-for-dashboard'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, name, logo_url, is_internal')
      return (data || []).reduce((acc, c) => ({ ...acc, [c.id]: c }), {})
    }
  })

  // 2. Scheduled Posts
  const { data: posts = [], isLoading: loadingPosts } = useGlobalPosts()
  const scheduledPosts = posts
    .filter(p => p.status === 'SCHEDULED' && p.target_date)
    .sort((a, b) => new Date(a.target_date) - new Date(b.target_date))

  const visiblePosts = scheduledPosts.slice(0, 3)
  const extraPosts = scheduledPosts.length - 3

  return (
    <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex flex-col gap-2 h-full">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg font-medium">Post Releases</CardTitle>
        <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2" onClick={() => navigate('/posts')}>
           <ArrowUpRight className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pt-0">
        {loadingPosts ? (
          <div className="space-y-4 py-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : visiblePosts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-2">
            <div className="h-10 w-10 border border-dashed rounded-full flex items-center justify-center text-muted-foreground">
              <Send className="h-4 w-4" />
            </div>
            <p className="text-sm text-muted-foreground">No scheduled posts</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0 mt-2">
            <div className="space-y-0">
              {visiblePosts.map((post) => (
                <PostReleaseItem 
                  key={post.id} 
                  post={post} 
                  clientsMap={clientsMap} 
                />
              ))}
            </div>
            {extraPosts > 0 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-dashed border-border/40">
                <span className="text-xs text-muted-foreground">
                  +{extraPosts} more post{extraPosts !== 1 && 's'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground -mr-2"
                  onClick={() => navigate('/posts')}
                >
                  View all posts <ArrowUpRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
