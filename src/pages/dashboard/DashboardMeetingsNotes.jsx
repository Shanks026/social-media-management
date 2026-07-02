import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useNavigate } from 'react-router-dom'
import {
  CalendarIcon,
  FileText,
  Plus,
  ArrowUpRight,
  ClipboardCheck,
} from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import MeetingRow from '@/components/MeetingRow'
import CreateMeetingDialog from '@/components/CreateMeetingDialog'
import CreateTaskDialog from '@/components/tasks/CreateTaskDialog'
import TaskCard from '@/components/tasks/TaskCard'
import { deleteMeeting } from '@/api/meetings'
import { useMyTasks } from '@/api/tasks'
import { useTeamMembers } from '@/api/team'
import { useSubscription } from '@/api/useSubscription'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function DashboardMeetingsNotes() {
  const [activeTab, setActiveTab] = useState('notes')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { workspaceUserId, user } = useAuth()
  const { data: sub } = useSubscription()
  const hasNoExternalClients = (sub?.client_count ?? 1) === 0

  const { data: clientsMap = {} } = useQuery({
    queryKey: ['clients-map-for-dashboard', workspaceUserId],
    queryFn: async () => {
      if (!workspaceUserId) return {}
      const { data } = await supabase
        .from('clients')
        .select('id, name, logo_url, is_internal')
        .eq('user_id', workspaceUserId)
      const map = (data || []).reduce((acc, c) => ({ ...acc, [c.id]: c }), {})
      const internalClient = (data || []).find((c) => c.is_internal)
      map['null'] = internalClient || {
        id: null,
        name: 'Internal (Agency)',
        is_internal: true,
      }
      return map
    },
    enabled: !!workspaceUserId,
  })

  const { data: upcomingMeetings = [], isLoading: loadingMeetings } = useQuery({
    queryKey: ['meetings', 'dashboard-upcoming'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .gte('datetime', new Date().toISOString())
        .order('datetime', { ascending: true })
      if (error) throw error
      return data
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const { mutate: markMeetingDone, isPending: isCompletingMeeting } =
    useMutation({
      mutationFn: (meetingId) => deleteMeeting(meetingId),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['meetings'] })
        queryClient.invalidateQueries({ queryKey: ['todayMeetings'] })
        toast.success('Meeting marked as done')
      },
      onError: (error) =>
        toast.error('Failed to update meeting: ' + error.message),
    })

  const { data: activeTasks = [], isLoading: loadingTasks } = useMyTasks()
  const { data: teamMembers = [] } = useTeamMembers()

  const memberMap = useMemo(() => {
    const map = Object.fromEntries(teamMembers.map((m) => [m.member_user_id, m]))
    if (user && !map[user.id]) {
      map[user.id] = {
        member_user_id: user.id,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        email: user.email,
        avatar_url: user.user_metadata?.avatar_url || null,
      }
    }
    return map
  }, [teamMembers, user])

  const visibleMeetings = upcomingMeetings.slice(0, 3)
  const extraMeetings = upcomingMeetings.length - 3
  const visibleTasks = activeTasks.slice(0, 2)
  const extraTasks = activeTasks.length - 2

  return (
    <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 dark:bg-card/30 flex flex-col h-full">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1"
      >
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 shrink-0">
          <TabsList className="h-9">
            <TabsTrigger value="notes" className="gap-1.5 text-xs">
              <ClipboardCheck className="size-3.5" /> Tasks
            </TabsTrigger>
            <TabsTrigger value="meetings" className="gap-1.5 text-xs">
              <CalendarIcon className="size-3.5" /> Meetings
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-1">
            {activeTab === 'meetings' ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <CreateMeetingDialog
                      lockClient={false}
                      onSuccess={() =>
                        queryClient.refetchQueries({ queryKey: ['meetings', 'dashboard-upcoming'] })
                      }
                    >
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={hasNoExternalClients}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </CreateMeetingDialog>
                  </span>
                </TooltipTrigger>
                {hasNoExternalClients && (
                  <TooltipContent>Add a client to schedule meetings</TooltipContent>
                )}
              </Tooltip>
            ) : (
              <CreateTaskDialog
                lockClient={false}
                onSuccess={() =>
                  queryClient.invalidateQueries({ queryKey: ['tasks', 'list'], exact: false })
                }
              >
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </CreateTaskDialog>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -mr-2"
              onClick={() =>
                navigate(
                  activeTab === 'meetings'
                    ? '/operations/meetings'
                    : '/operations/tasks',
                )
              }
            >
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col pt-0">
          {/* ─── MEETINGS TAB ─── */}
          <TabsContent value="meetings" className="mt-0 flex-1 flex flex-col">
            {loadingMeetings ? (
              <div className="space-y-3 py-1">
                {[...Array(2)].map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-2xl" />
                ))}
              </div>
            ) : visibleMeetings.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-2">
                <div className="h-10 w-10 border border-dashed rounded-full flex items-center justify-center text-muted-foreground">
                  <CalendarIcon className="h-4 w-4" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No upcoming meetings
                </p>
              </div>
            ) : (
              <div className="flex flex-col flex-1">
                <div className="flex flex-col gap-3">
                  {visibleMeetings.map((meeting) => (
                    <MeetingRow
                      key={meeting.id}
                      meeting={meeting}
                      clientsMap={clientsMap}
                      markMeetingDone={markMeetingDone}
                      isCompletingMeeting={isCompletingMeeting}
                      variant="dashboard-card"
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-dashed border-border/40">
                  {extraMeetings > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      +{extraMeetings} more meeting{extraMeetings !== 1 && 's'}
                    </span>
                  ) : (
                    <span />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground -mr-2"
                    onClick={() => navigate('/operations/meetings')}
                  >
                    View all <ArrowUpRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ─── TASKS TAB ─── */}
          <TabsContent value="notes" className="mt-0 flex-1 flex flex-col">
            {loadingTasks ? (
              <div className="space-y-3 py-1">
                {[...Array(2)].map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-2xl" />
                ))}
              </div>
            ) : visibleTasks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-2">
                <div className="h-10 w-10 border border-dashed rounded-full flex items-center justify-center text-muted-foreground">
                  <FileText className="h-4 w-4 opacity-50" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No pending tasks
                </p>
              </div>
            ) : (
              <div className="flex flex-col flex-1">
                <div className="flex flex-col gap-3">
                  {visibleTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      clientMap={clientsMap}
                      memberMap={memberMap}
                      currentUserId={user?.id}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-dashed border-border/40">
                  {extraTasks > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      +{extraTasks} more task{extraTasks !== 1 && 's'}
                    </span>
                  ) : (
                    <span />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground -mr-2"
                    onClick={() => navigate('/operations/tasks')}
                  >
                    View all <ArrowUpRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}
