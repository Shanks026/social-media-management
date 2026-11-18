import { useEffect, useRef } from 'react'
import { useTodayMeetings } from '@/api/meetings'
import { toast } from 'sonner'
import { differenceInMinutes, isFuture } from 'date-fns'

export function useMeetingReminders() {
  const notifiedMeetingsRef = useRef(new Set())

  // Today's meetings, refreshed every 5 minutes in the background
  const { data: meetings = [] } = useTodayMeetings()

  useEffect(() => {
    if (!meetings.length) return

    const checkReminders = () => {
      const now = new Date()

      meetings.forEach(meeting => {
        if (notifiedMeetingsRef.current.has(meeting.id)) return

        const meetingTime = new Date(meeting.datetime)
        
        // Only care about future meetings
        if (!isFuture(meetingTime)) return

        const diffMinutes = differenceInMinutes(meetingTime, now)

        // If meeting is exactly or less than 15 mins away (and > 0)
        if (diffMinutes <= 15 && diffMinutes >= 0) {
          toast.info(`Upcoming Meeting: ${meeting.title}`, {
            description: `with ${meeting.client_name} in ${diffMinutes} minutes.`
          })
          notifiedMeetingsRef.current.add(meeting.id)
        }
      })
    }

    // Check immediately, then every 1 minute
    checkReminders()
    const intervalId = setInterval(checkReminders, 60 * 1000)

    return () => clearInterval(intervalId)
  }, [meetings])
}
