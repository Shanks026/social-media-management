import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { format, isToday, isTomorrow, differenceInDays } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import {
  CalendarIcon,
  FileText,
  Plus,
  ArrowUpRight,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

import NoteRow from '@/components/NoteRow'
import MeetingRow from '@/components/MeetingRow'
import CreateMeetingDialog from '@/components/CreateMeetingDialog'
import CreateNoteDialog from '@/components/CreateNoteDialog'
import { deleteMeeting } from '@/api/meetings'

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function DashboardMeetingsNotes() {
  const [activeTab, setActiveTab] = useState('meetings')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, workspaceUserId } = useAuth()

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

  const { data: notes = [], isLoading: loadingNotes } = useQuery({
    queryKey: ['global-notes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_notes')
        .select('*')
        .in('status', ['TODO', 'DONE'])
        .order('status', { ascending: false })
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const visibleMeetings = upcomingMeetings.slice(0, 2)
  const extraMeetings = upcomingMeetings.length - 2
  const visibleNotes = notes.slice(0, 2)
  const extraNotes = notes.length - 2

  return (
    <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 dark:bg-card/30 flex flex-col h-full">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1"
      >
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 shrink-0">
          <TabsList className="h-9">
            <TabsTrigger value="meetings" className="gap-1.5 text-xs">
              <CalendarIcon className="size-3.5" /> Meetings
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5 text-xs">
              <FileText className="size-3.5" /> Notes
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-1">
            {activeTab === 'meetings' ? (
              <CreateMeetingDialog
                lockClient={false}
                onSuccess={() =>
                  queryClient.refetchQueries({ queryKey: ['meetings', 'dashboard-upcoming'] })
                }
              >
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </CreateMeetingDialog>
            ) : (
              <CreateNoteDialog
                lockClient={false}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['global-notes'] })
                  queryClient.invalidateQueries({ queryKey: ['notes', 'week-timeline'] })
                }}
              >
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </CreateNoteDialog>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -mr-2 text-muted-foreground hover:text-foreground"
              onClick={() =>
                navigate(
                  activeTab === 'meetings'
                    ? '/operations/meetings'
                    : '/operations/notes',
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
              <div className="flex flex-col gap-3">
                {visibleMeetings.map((meeting) => (
                  <MeetingRow
                    key={meeting.id}
                    meeting={meeting}
                    clientsMap={clientsMap}
                    markMeetingDone={markMeetingDone}
                    isCompletingMeeting={isCompletingMeeting}
                    variant="dashboard-card"
                    alwaysShowActions
                  />
                ))}
                {extraMeetings > 0 && (
                  <div className="flex items-center justify-between pt-3 border-t border-dashed border-border/40">
                    <span className="text-xs text-muted-foreground">
                      +{extraMeetings} more meeting
                      {extraMeetings !== 1 && 's'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground -mr-2"
                      onClick={() => navigate('/operations/meetings')}
                    >
                      View all <ArrowUpRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ─── NOTES TAB ─── */}
          <TabsContent value="notes" className="mt-0 flex-1 flex flex-col">
            {loadingNotes ? (
              <div className="space-y-3 py-1">
                {[...Array(2)].map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-2xl" />
                ))}
              </div>
            ) : visibleNotes.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-2">
                <div className="h-10 w-10 border border-dashed rounded-full flex items-center justify-center text-muted-foreground">
                  <FileText className="h-4 w-4 opacity-50" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No pending notes
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {visibleNotes.map((note) => (
                  <NoteRow
                    key={note.id}
                    note={note}
                    clientMap={clientsMap}
                    showClient={true}
                    variant="dashboard-card"
                    alwaysShowActions
                  />
                ))}
                {extraNotes > 0 && (
                  <div className="flex items-center justify-between pt-3 border-t border-dashed border-border/40">
                    <span className="text-xs text-muted-foreground">
                      +{extraNotes} more note{extraNotes !== 1 && 's'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground -mr-2"
                      onClick={() => navigate('/operations/notes')}
                    >
                      View all <ArrowUpRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}
