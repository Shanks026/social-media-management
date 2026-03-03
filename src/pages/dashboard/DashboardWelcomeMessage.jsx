import { useMemo, useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { format, getDay } from 'date-fns'

// Multiple messages per slot, indexed by day of week (0=Sun … 6=Sat)
const MESSAGES = {
  lateNight: [
    "Burning the midnight oil? Don't forget to rest — great work waits for a rested mind.",
    "Late nights build empires, but so does sleep. Wrap up and recharge.",
    "The agency will still be here in the morning. Take care of yourself first.",
    "Even the best strategists need downtime. You've earned the break.",
    "Midnight grind mode: respect. But seriously, close the laptop soon.",
    "You're still at it? That's dedication. Don't forget to eat something too.",
    "The hustle is real tonight. Make sure tomorrow-you appreciates the effort.",
  ],
  morning: [
    "A fresh week starts today — let's set the tone.",
    "Monday energy: set your priorities and own the week.",
    "New day, clean slate. What's the one thing that moves the needle today?",
    "Mid-week momentum — you're past the hump, keep pushing.",
    "Almost there. Two more days and the weekend is yours.",
    "Friday! Close out the week strong and tie up any loose ends.",
    "Weekend check-in? Dedicated. Let's make it quick and worth it.",
  ],
  afternoon: [
    "Post-lunch lull? Push through — the best work often happens now.",
    "Halfway through the day. How are those priorities tracking?",
    "Afternoon focus window — minimize distractions and close a few tasks.",
    "The afternoon grind is where progress quietly happens.",
    "Client updates, approvals, follow-ups — good time to clear the queue.",
    "Friday afternoon: tie up loose ends before the weekend rush.",
    "Weekend afternoon check-in — appreciated. Make it count.",
  ],
  evening: [
    "Winding down? Here's a snapshot of where things stand.",
    "Good progress today. Review, reflect, and plan tomorrow.",
    "Evening review time — what shipped, what's still open?",
    "End of the work day. Did you chase that overdue approval?",
    "Thursday evening: one more push and you're headed into the weekend.",
    "TGIF! Wrap up, log off, and actually disconnect this weekend.",
    "Saturday evening — you're dedicated. Don't burn out.",
  ],
}

const EMOJIS = {
  lateNight: ['🌙', '🦉', '☕', '🌌'],
  morning: ['☀️', '🌤️', '🚀', '⚡', '🌿', '🔥', '✨'],
  afternoon: ['☀️', '💼', '📊', '⚡', '🎯', '📅', '🌴'],
  evening: ['🌆', '📋', '✅', '🍃', '🎉', '🥂', '🌇'],
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

  const { greeting, message, emoji } = useMemo(() => {
    const hour = time.getHours()
    const dayIndex = getDay(time) // 0 = Sunday

    let slot = 'evening'
    let greetingText = 'Good Evening'

    if (hour >= 0 && hour < 5) {
      slot = 'lateNight'
      greetingText = 'Working Late'
    } else if (hour >= 5 && hour < 12) {
      slot = 'morning'
      greetingText = 'Good Morning'
    } else if (hour >= 12 && hour < 17) {
      slot = 'afternoon'
      greetingText = 'Good Afternoon'
    } else if (hour >= 17 && hour < 22) {
      slot = 'evening'
      greetingText = 'Good Evening'
    } else {
      slot = 'lateNight'
      greetingText = 'Working Late'
    }

    const msgs = MESSAGES[slot]
    const emojis = EMOJIS[slot]

    return {
      greeting: greetingText,
      message: msgs[dayIndex % msgs.length],
      emoji: emojis[dayIndex % emojis.length],
    }
  }, [time])

  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-2">
      <div className="space-y-1">
        <h1 className="text-3xl font-medium tracking-tight text-foreground">
          {greeting}, {firstName}! {emoji}
        </h1>
        <p className="text-muted-foreground font-medium text-sm">
          {message}
        </p>
      </div>
      <div className="text-sm font-medium text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full border border-border/50 shadow-sm shrink-0">
        {format(time, 'EEEE, MMMM do')}
      </div>
    </div>
  )
}
