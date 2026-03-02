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

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

import NoteRow from '@/components/NoteRow'
import CreateMeetingDialog from '@/components/CreateMeetingDialog'
import CreateNoteDialog from '@/components/CreateNoteDialog'
import { deleteMeeting } from '@/api/meetings'

// ─── HELPER COMPONENTS ────────────────────────────────────────────────────────

function MeetingItem({
  meeting,
  clientsMap,
  markMeetingDone,
  isCompletingMeeting,
}) {
  const meetingDate = new Date(meeting.datetime)
  let dateLabel = format(meetingDate, 'MMM d, yyyy')
  let variant = 'outline'

  if (isToday(meetingDate)) {
    dateLabel = 'Today'
    variant = 'default'
  } else if (isTomorrow(meetingDate)) {
    dateLabel = 'Tomorrow'
    variant = 'secondary'
  } else {
    const days = differenceInDays(meetingDate, new Date())
    if (days < 7) {
      dateLabel = `In ${days} Days`
      variant = 'secondary'
    }
  }

  const client = clientsMap[meeting.client_id]

  // Extract month and day for the square block
  const monthStr = format(meetingDate, 'MMM').toUpperCase()
  const dayStr = format(meetingDate, 'dd')

  return (
    <div className="hover:bg-background/80 transition-colors border-b border-dashed pb-4 mb-4 last:mb-0 last:pb-0 last:border-0">
      <div className="flex items-start gap-4 mb-2">
        {/* ─── DATE SQUARE BLOCK ─── */}
        <div className="flex flex-col items-center justify-center w-12 h-12 shrink-0 rounded-lg border border-border bg-muted/40 shadow-sm transition-colors group-hover:bg-muted/60">
          <span className="text-[10px] font-medium text-muted-foreground leading-none tracking-wider mb-1">
            {monthStr}
          </span>
          <span className="text-lg font-bold text-foreground leading-none">
            {dayStr}
          </span>
        </div>

        {/* ─── CONTENT AREA ─── */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm truncate text-foreground">
              {meeting.title}
            </p>
            <Badge
              variant={variant}
              className="text-[10px] px-1.5 py-0 h-5 shrink-0"
            >
              {dateLabel}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <Clock className="h-3 w-3 shrink-0" />
            {format(meetingDate, 'h:mm a')}
            {client && (
              <>
                <span className="hidden @[300px]:inline-block w-1 h-1 rounded-full bg-border shrink-0" />
                <span className="hidden @[300px]:inline-block truncate max-w-[140px]">
                  {client.name}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 border-border/40">
        <CreateMeetingDialog
          editMeeting={meeting}
          defaultClientId={meeting.client_id}
          lockClient={false}
        >
          <Button variant="outline" size="sm" className="flex-1 h-7 text-xs">
            Reschedule
          </Button>
        </CreateMeetingDialog>
        <Button
          variant="secondary"
          size="sm"
          className="flex-1 h-7 text-xs"
          onClick={() => markMeetingDone(meeting.id)}
          disabled={isCompletingMeeting}
        >
          Mark as done
        </Button>
      </div>
    </div>
  )
}

export default function DashboardUpcomingEvents() {
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

  const visibleMeetings = upcomingMeetings.slice(0, 3)
  const extraMeetings = upcomingMeetings.length - 3
  const visibleNotes = notes.slice(0, 4)
  const extraNotes = notes.length - 4

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* ─── UPCOMING MEETINGS ─────────────────────────────────────────────────── */}
      <Card className="@container border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex flex-col gap-2">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-medium">
            Upcoming Meetings
          </CardTitle>
          <CreateMeetingDialog lockClient={false}>
            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
              <Plus className="h-4 w-4" />
            </Button>
          </CreateMeetingDialog>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col pt-0">
          {loadingMeetings ? (
            <div className="space-y-4 py-2">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : visibleMeetings.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-2">
              <div className="h-10 w-10 border border-dashed rounded-full flex items-center justify-center text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
              </div>
              <p className="text-sm text-muted-foreground">
                No upcoming meetings
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-0 mt-2">
              <div className="space-y-0">
                {visibleMeetings.map((meeting) => (
                  <MeetingItem
                    key={meeting.id}
                    meeting={meeting}
                    clientsMap={clientsMap}
                    markMeetingDone={markMeetingDone}
                    isCompletingMeeting={isCompletingMeeting}
                  />
                ))}
              </div>
              {extraMeetings > 0 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-dashed border-border/40">
                  <span className="text-xs text-muted-foreground">
                    +{extraMeetings} more meeting{extraMeetings !== 1 && 's'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground -mr-2"
                    onClick={() => navigate('/operations/meetings')}
                  >
                    View all meetings <ArrowUpRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── ACTIVE NOTES & REMINDERS ──────────────────────────────────────────── */}
      <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex flex-col gap-2 h-full">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-medium">
            Notes & Reminders
          </CardTitle>
          <CreateNoteDialog lockClient={false}>
            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
              <Plus className="h-4 w-4" />
            </Button>
          </CreateNoteDialog>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 pt-0">
          {loadingNotes ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-start gap-3 py-1">
                  <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : visibleNotes.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-2">
              <div className="h-10 w-10 border border-dashed rounded-full flex items-center justify-center text-muted-foreground">
                <FileText className="h-4 w-4 opacity-50" />
              </div>
              <p className="text-sm text-muted-foreground">No pending notes</p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 mt-2">
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
              </div>

              {extraNotes > 0 && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed border-border/40">
                  <span className="text-xs text-muted-foreground">
                    +{extraNotes} more note{extraNotes !== 1 && 's'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground -mr-2"
                    onClick={() => navigate('/operations/notes')}
                  >
                    View all notes <ArrowUpRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
