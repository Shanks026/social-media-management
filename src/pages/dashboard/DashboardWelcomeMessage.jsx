import { useMemo, useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { format, getDay } from 'date-fns'

// Greeting templates — {name} is replaced at render time
// Indexed by day of week (0=Sun … 6=Sat) to rotate per-day
const GREETINGS = {
  lateNight: [
    "Still at it, {name}? 🌙",
    "Night owl mode, {name}. ☕",
    "Burning the midnight oil, {name}? 🕯️",
    "Late night dispatch, {name}. 🌌",
    "The quiet hours suit you, {name}. 🌙",
    "Working late again, {name}? ☕",
    "Still here, {name}. 🦉",
  ],
  morning: [
    "Morning, {name}. ☀️",
    "Up and at it, {name}. ☕",
    "Early start, {name}. 🌿",
    "A fresh one, {name}. ☀️",
    "Almost Friday, {name}. ⚡",
    "Last push of the week, {name}. 🎉",
    "Weekend check-in, {name}? ☕",
  ],
  afternoon: [
    "Afternoon, {name}. 🌞",
    "Midday, {name}. ☕",
    "Peak hours, {name}. ⚡",
    "Afternoon window, {name}. 🌤️",
    "Almost there, {name}. 🌿",
    "Friday stretch, {name}. 🎉",
    "Weekend's close, {name}. 🌴",
  ],
  evening: [
    "Evening, {name}. 🌆",
    "Good evening, {name}. 🌙",
    "Evening focus, {name}. ⚡",
    "Evening session, {name}. 🌇",
    "Evening window, {name}. ✨",
    "Friday evening, {name}. 🎉",
    "Saturday evening, {name}. 🌙",
  ],
}

// Sub-messages per slot, indexed by day of week
const MESSAGES = {
  lateNight: [
    "Most of it can wait until morning.",
    "The agency will still be here tomorrow — rest up.",
    "Late night noted. Don't forget to sleep.",
    "Worth finishing, or can it wait until tomorrow?",
    "Make a note of where you left off before you close up.",
    "The effort tonight will make tomorrow a bit easier.",
    "Late nights are occasional, not a habit — you good?",
  ],
  morning: [
    "What's the one thing that matters most today?",
    "Start the week with a short list and a clear head.",
    "What needs to move forward today?",
    "Midweek already — anything stalled that needs a nudge?",
    "Almost Friday. What needs to land before then?",
    "Close out the week — anything still outstanding?",
    "Weekend work deserves a clear goal. What's the focus?",
  ],
  afternoon: [
    "Good time to chase any pending approvals.",
    "Halfway through — are you on track?",
    "Afternoon is often the best window for focused work.",
    "Any client responses still waiting on you?",
    "Good time to clear the small stuff before end of day.",
    "Friday afternoon — tie up any loose ends before the weekend.",
    "Quick check-in. What's still open?",
  ],
  evening: [
    "Evenings are when some of the best work happens.",
    "Fewer distractions, more focus — good time to make progress.",
    "Evening sessions hit different. What are you working on?",
    "The inbox is quiet. Use it.",
    "Client work or internal stuff — either way, you've got the time.",
    "Friday evening still counts. What needs to ship?",
    "Late evening, low noise — ideal for getting things done.",
  ],
}

export default function DashboardWelcomeMessage() {
  const { user } = useAuth()
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const fullName = user?.user_metadata?.full_name || 'there'
  const firstName = fullName.split(' ')[0]

  const { greeting, message } = useMemo(() => {
    const hour = time.getHours()
    const dayIndex = getDay(time) // 0 = Sunday

    let slot = 'evening'
    if (hour >= 0 && hour < 5) slot = 'lateNight'
    else if (hour >= 5 && hour < 12) slot = 'morning'
    else if (hour >= 12 && hour < 17) slot = 'afternoon'
    else if (hour >= 17 && hour < 22) slot = 'evening'
    else slot = 'lateNight'

    const greetings = GREETINGS[slot]
    const msgs = MESSAGES[slot]
    const template = greetings[dayIndex % greetings.length]

    return {
      greeting: template.replace('{name}', firstName),
      message: msgs[dayIndex % msgs.length],
    }
  }, [time, firstName])

  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-2">
      <div className="space-y-1">
        <h1 className="text-3xl font-medium tracking-tight text-foreground">
          {greeting}
        </h1>
        <p className="text-muted-foreground font-medium text-sm">
          {message}
        </p>
      </div>
      <div className="text-sm text-muted-foreground shrink-0">
        {format(time, 'EEEE, MMMM do')}
      </div>
    </div>
  )
}
