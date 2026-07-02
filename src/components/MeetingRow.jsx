import { format, isToday, isTomorrow, differenceInDays } from 'date-fns'
import { CheckCircle2, Clock, Link as LinkIcon, Lock, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import CreateMeetingDialog from '@/components/CreateMeetingDialog'
import { ClientAvatar } from '@/components/tasks/ClientAvatar'

/**
 * Props:
 *  - meeting             — the meeting object
 *  - clientsMap          — { [clientId]: client } — optional, used in dashboard-card
 *  - markMeetingDone     — function to mark as done
 *  - isCompletingMeeting — boolean loading state
 *  - variant             — 'row' (default), 'dashboard-card', 'client-card'
 */
export default function MeetingRow({
  meeting,
  clientsMap = {},
  markMeetingDone,
  isCompletingMeeting,
  variant = 'row',
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
      dateLabel = `In ${days} Days`
      badgeVariant = 'secondary'
    }
  }

  const isOverdue = meetingDate.getTime() < Date.now()
  const client = clientsMap[meeting.client_id]
  const monthStr = format(meetingDate, 'MMM').toUpperCase()
  const dayStr = format(meetingDate, 'dd')

  const isCard = variant === 'dashboard-card' || variant === 'client-card'

  if (isCard) {
    return (
      <div className="@container bg-white dark:bg-card/50 rounded-xl shadow-sm ring-1 ring-border/50 overflow-hidden flex flex-col h-full">
        <div className="px-5 pt-5 pb-4 flex flex-col flex-1">
          {/* Header: date block + title + badge */}
          <div className="flex items-start gap-4 mb-2">
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
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="font-semibold text-sm leading-snug text-foreground line-clamp-2">
                    {meeting.title}
                  </p>
                  {meeting.meeting_link && (
                    <LinkIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  )}
                </div>
                <Badge
                  variant={badgeVariant}
                  className="text-[10px] px-1.5 py-0 h-5 shrink-0"
                >
                  {dateLabel}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                <Clock className="h-3 w-3 shrink-0" />
                {format(meetingDate, 'h:mm a')}
                {meeting.visibility === 'private' && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <Lock className="h-2.5 w-2.5 shrink-0" />
                    <span>Private</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Notes — min-h keeps both 1-line and 2-line cards visually consistent */}
          <div className="mt-2 pl-16 min-h-[40px]">
            {meeting.notes ? (
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {meeting.notes}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground/40 italic">
                No notes
              </p>
            )}
          </div>

          <div className="flex-1" />

          {/* Divider */}
          <div className="border-t border-dashed border-border/60 mt-4 mb-3" />

          {/* Footer: actions left, client name (dashboard) or date (client) right */}
          <div className="flex items-center justify-between pl-1">
            <div className="flex items-center gap-1 -ml-3">
              <Tooltip delayDuration={400}>
                <TooltipTrigger asChild>
                  <CreateMeetingDialog
                    editMeeting={meeting}
                    defaultClientId={meeting.client_id}
                    lockClient={variant === 'client-card'}
                    campaignId={meeting.campaign_id ?? null}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-primary"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </CreateMeetingDialog>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Edit</TooltipContent>
              </Tooltip>
              {meeting.meeting_link && (
                <Tooltip delayDuration={400}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-primary"
                      onClick={() => window.open(meeting.meeting_link, '_blank')}
                    >
                      <LinkIcon className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-65 break-all text-xs">
                    {meeting.meeting_link}
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip delayDuration={400}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-emerald-600"
                    onClick={() => markMeetingDone(meeting.id)}
                    disabled={isCompletingMeeting}
                  >
                    <CheckCircle2 className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Mark as done</TooltipContent>
              </Tooltip>
            </div>

            {variant === 'dashboard-card' && client ? (
              <div className="flex items-center gap-2">
                <ClientAvatar client={client} size="sm" />
                <span className="text-xs font-semibold text-foreground truncate max-w-36">
                  {client.name}
                </span>
                {client.is_internal && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0">INT</Badge>
                )}
                {isOverdue && (
                  <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">Overdue</Badge>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                <span>{format(meetingDate, 'd MMMM yyyy')}</span>
                {isOverdue && (
                  <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 ml-1">Overdue</Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Fallback / plain row mode
  return (
    <div className="flex items-center justify-between py-3 border-b border-dashed last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center justify-center w-10 h-10 shrink-0 rounded-lg border border-border bg-muted/40">
          <span className="text-[10px] font-medium text-muted-foreground leading-none mb-1">
            {monthStr}
          </span>
          <span className="text-base font-bold text-foreground leading-none">
            {dayStr}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {meeting.title}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> {format(meetingDate, 'h:mm a')}
            {meeting.visibility === 'private' && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <Lock className="h-2.5 w-2.5 shrink-0" />
                <span>Private</span>
              </>
            )}
          </p>
        </div>
      </div>
      <Badge variant={badgeVariant} className="text-[10px]">
        {dateLabel}
      </Badge>
    </div>
  )
}
