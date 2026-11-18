import { toast } from 'sonner'
import { useSetMeetingCompleted } from '@/api/meetings'

/**
 * Shared "Mark as done" action for meeting cards. Sets `completed_at`; it
 * never deletes the meeting. The meeting hook refreshes every meeting view
 * (dashboard, client overview, calendar, reminders).
 */
export function useMarkMeetingDone() {
  const { mutate, isPending } = useSetMeetingCompleted({
    onSuccess: () => toast.success('Meeting marked as done'),
    onError: (error) =>
      toast.error('Failed to update meeting: ' + (error?.message || 'Something went wrong')),
  })

  return {
    markMeetingDone: (meetingId) => mutate({ id: meetingId, completed: true }),
    isCompletingMeeting: isPending,
  }
}
