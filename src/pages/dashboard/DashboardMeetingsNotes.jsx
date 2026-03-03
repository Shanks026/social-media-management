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

import NoteRow, { ClientAvatar } from '@/components/NoteRow'
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
      {/* ─── MAIN CONTENT ─── */}
      <div className="px-5 pt-5 pb-4">
        {/* Header: date block + title + badge */}
        <div className="flex items-start gap-3">
          {/* Date block */}
          <div className="flex flex-col items-center justify-center w-12 h-12 shrink-0 rounded-xl border border-border bg-muted/40 mt-0.5">
            <span className="text-[10px] font-medium text-muted-foreground leading-none tracking-wider mb-1">
              {monthStr}
            </span>
            <span className="text-lg font-bold text-foreground leading-none">
              {dayStr}
            </span>
          </div>

          {/* Title + badge */}
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

        {/* Notes / description */}
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

      {/* ─── HOVER ACTION BAR ─── */}
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
  const visibleNotes = notes.slice(0, 3)
  const extraNotes = notes.length - 3

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* ─── UPCOMING MEETINGS ─────────────────────────────────────────────────── */}
      <Card className="@container border-none shadow-sm ring-1 ring-border/50 bg-card/50 dark:bg-card/30 flex flex-col gap-2">
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
      <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 dark:bg-card/30 flex flex-col gap-2 h-full">
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
