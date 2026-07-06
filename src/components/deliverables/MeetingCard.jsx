import { format } from 'date-fns'
import { Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ClientAvatar } from '@/components/tasks/ClientAvatar'
import CreateMeetingDialog from '@/components/CreateMeetingDialog'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteMeeting } from '@/api/meetings'
import { toast } from 'sonner'

/**
 * Card representation of a meeting, styled to match DeliverableCard so both
 * can be mixed in the same grid (e.g. a day's scheduled items).
 */
export function MeetingCard({ meeting }) {
  const queryClient = useQueryClient()

  const { mutate: handleDeleteMeeting, isPending: isDeletingMeeting } =
    useMutation({
      mutationFn: () => deleteMeeting(meeting.id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['meetings'] })
        queryClient.invalidateQueries({ queryKey: ['todayMeetings'] })
        queryClient.invalidateQueries({ queryKey: ['upcomingMeetings'] })
        queryClient.invalidateQueries({ queryKey: ['calendar'] })
        toast.success('Meeting marked as done')
      },
      onError: (error) => {
        toast.error('Failed to update meeting: ' + error.message)
      },
    })

  if (!meeting) return null

  return (
    <div className="flex flex-col bg-card/50 shadow-sm rounded-2xl px-6 py-8 transition-all duration-200 border border-blue-200/50 dark:border-blue-900/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Badge
          variant="outline"
          className=" text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 rounded-full px-2.5 py-0.5 border-none font-medium"
        >
          Meeting
        </Badge>
      </div>

      {/* Title */}
      <h3 className="text-lg font-medium tracking-tight text-foreground mb-6 line-clamp-1">
        {meeting.title}
      </h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-6 min-h-10">
        {meeting.notes || 'No agenda provided'}
      </p>

      {/* Dotted Divider & Footer */}
      <div className="mt-auto">
        <hr className="border-t border-dashed border-border mb-4" />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <CreateMeetingDialog
              editMeeting={meeting}
              defaultClientId={meeting.client_id}
            >
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={(e) => e.stopPropagation()}
              >
                Reschedule
              </Button>
            </CreateMeetingDialog>
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteMeeting()
              }}
              disabled={isDeletingMeeting}
            >
              Mark as done
            </Button>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            {meeting.client_name && (
              <div className="flex items-center gap-1.5 min-w-0">
                <ClientAvatar
                  client={{
                    logo_url: meeting.client_logo,
                    name: meeting.client_name,
                  }}
                  size="sm"
                />
                <span className="text-xs font-semibold text-foreground truncate max-w-[100px]">
                  {meeting.client_name}
                </span>
              </div>
            )}
            <div className="bg-muted/50 rounded-full px-3 py-1.5 flex items-center justify-center shrink-0">
              <span className="text-[13px] font-medium text-muted-foreground tracking-tight flex items-center gap-1.5">
                <Clock size={14} className="text-blue-500" />
                {meeting.target_date
                  ? format(
                      new Date(meeting.target_date),
                      "d MMMM yyyy '•' h:mm a",
                    )
                  : 'No Date Set'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MeetingCard
