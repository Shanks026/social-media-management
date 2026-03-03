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

import NoteRow, { ClientAvatar } from '@/components/NoteRow'
import CreateMeetingDialog from '@/components/CreateMeetingDialog'
import CreateNoteDialog from '@/components/CreateNoteDialog'
import { deleteMeeting } from '@/api/meetings'

// ─── MEETING CARD ─────────────────────────────────────────────────────────────

function MeetingItem({
  meeting,
  clientsMap,
  markMeetingDone,
  isCompletingMeeting,
}) {
  const meetingDate = new Date(meeting.datetime)
  let dateLabel = format(meetingDate, 'MMM d, yyyy')
  let badgeVariant = 'outline'

  if (isToday(meetingDate)) {
    dateLabel = 'Today'
    badgeVariant = 'default'
  } else if (isTomorrow(meetingDate)) {
    dateLabel = 'Tomorrow'
    badgeVariant = 'secondary'
  } else {
    const days = differenceInDays(meetingDate, new Date())
    if (days > 0 && days < 7) {
      dateLabel = `${days} Days`
      badgeVariant = 'secondary'
    }
  }

  const client = clientsMap[meeting.client_id]
  const monthStr = format(meetingDate, 'MMM').toUpperCase()
  const dayStr = format(meetingDate, 'dd')

  return (
    <div className="group bg-white dark:bg-card/50 rounded-2xl shadow-sm ring-1 ring-border/50 overflow-hidden">
      <div className="px-5 pt-5 pb-4">
        {/* Header: date block + title + badge */}
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center justify-center w-12 h-12 shrink-0 rounded-xl border border-border bg-muted/40 mt-0.5">
            <span className="text-[10px] font-medium text-muted-foreground leading-none tracking-wider mb-1">
              {monthStr}
            </span>
            <span className="text-lg font-bold text-foreground leading-none">
              {dayStr}
            </span>
          </div>
          <div className="flex-1 min-w-0 mt-0.5">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-sm leading-snug text-foreground line-clamp-2">
                {meeting.title}
              </p>
              <Badge
                variant={badgeVariant}
                className="text-[10px] px-1.5 py-0 h-5 shrink-0"
              >
                {dateLabel}
              </Badge>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="mt-0 pl-15">
          {meeting.notes ? (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {meeting.notes}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/40 italic">No notes</p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-border/60 mt-4 mb-3" />

        {/* Footer: client (left) + date/time (right) */}
        <div className="flex items-center justify-between pl-1">
          {client ? (
            <div className="flex items-center gap-2">
              <ClientAvatar client={client} size="sm" />
              <span className="text-xs font-semibold text-foreground truncate max-w-36">
                {client.name}
              </span>
              {client.is_internal && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0">
                  INT
                </Badge>
              )}
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            <span>{format(meetingDate, 'd MMMM yyyy')}</span>
            <span className="w-1 h-1 rounded-full bg-current opacity-50 shrink-0" />
            <span>{format(meetingDate, 'h:mma')}</span>
          </div>
        </div>
      </div>

      {/* Hover action bar */}
      <div className="grid transition-all duration-200 ease-in-out grid-rows-[0fr] group-hover:grid-rows-[1fr]">
        <div className="overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-t border-border/40 bg-muted/30">
            <CreateMeetingDialog
              editMeeting={meeting}
              defaultClientId={meeting.client_id}
              lockClient={false}
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              >
                <CalendarIcon className="size-3" /> Reschedule
              </Button>
            </CreateMeetingDialog>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-emerald-600 gap-1.5"
              onClick={() => markMeetingDone(meeting.id)}
              disabled={isCompletingMeeting}
            >
              <CheckCircle2 className="size-3" /> Mark as done
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function DashboardMeetingsNotes() {
  const [activeTab, setActiveTab] = useState('meetings')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const { data: clientsMap = {} } = useQuery({
    queryKey: ['clients-map-for-dashboard', user?.id],
    queryFn: async () => {
      if (!user) return {}
      const { data } = await supabase
        .from('clients')
        .select('id, name, logo_url, is_internal')
        .eq('user_id', user.id)
      const map = (data || []).reduce((acc, c) => ({ ...acc, [c.id]: c }), {})
      const internalClient = (data || []).find((c) => c.is_internal)
      map['null'] = internalClient || {
        id: null,
        name: 'Internal (Agency)',
        is_internal: true,
      }
      return map
    },
    enabled: !!user?.id,
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

          {activeTab === 'meetings' ? (
            <CreateMeetingDialog lockClient={false}>
              <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                <Plus className="h-4 w-4" />
              </Button>
            </CreateMeetingDialog>
          ) : (
            <CreateNoteDialog lockClient={false}>
              <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                <Plus className="h-4 w-4" />
              </Button>
            </CreateNoteDialog>
          )}
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
                  <MeetingItem
                    key={meeting.id}
                    meeting={meeting}
                    clientsMap={clientsMap}
                    markMeetingDone={markMeetingDone}
                    isCompletingMeeting={isCompletingMeeting}
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
                <p className="text-sm text-muted-foreground">No pending notes</p>
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
