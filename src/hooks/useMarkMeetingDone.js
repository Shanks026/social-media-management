import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { markMeetingCompleted } from '@/api/meetings'

/**
 * Shared "Mark as done" mutation for meeting cards. Sets `completed_at`; it
 * never deletes the meeting. Invalidates every meeting cache family so the
 * dashboard, client overview, calendar and reminders all refresh.
 */
export function useMarkMeetingDone() {
  const queryClient = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: (meetingId) => markMeetingCompleted(meetingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] })
      queryClient.invalidateQueries({ queryKey: ['todayMeetings'] })
      queryClient.invalidateQueries({ queryKey: ['upcomingMeetings'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      toast.success('Meeting marked as done')
    },
    onError: (error) =>
      toast.error('Failed to update meeting: ' + (error?.message || 'Something went wrong')),
  })

  return { markMeetingDone: mutate, isCompletingMeeting: isPending }
}
