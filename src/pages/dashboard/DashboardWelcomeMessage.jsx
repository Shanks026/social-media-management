import { useMemo, useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { format, getDay } from 'date-fns'

// Greeting templates — {name} is replaced at render time
// Indexed by day of week (0=Sun … 6=Sat) to rotate per-day
const GREETINGS = {
  lateNight: [
    "{name}'s still here? 🌙",
    "Night owl spotted — {name}! 🦉",
    "Burning the midnight oil, {name}? ☕",
    "{name}'s midnight grind! 🌌",
    "The world sleeps, {name} ships. 🌙",
    "Still going, {name}? Respect. 🦉",
    "Late-night mode activated, {name}. ☕",
  ],
  morning: [
    "Rise and shine, {name}! ☀️",
    "{name}'s back at it! 🚀",
    "Morning, {name}! Let's make it count. ⚡",
    "New day, new wins — {name}! 🌿",
    "Look who's up early, {name}! 🔥",
    "TGIF vibes start now, {name}! ✨",
    "Weekend warrior turned workday hero — {name}! ☀️",
  ],
  afternoon: [
    "Back at it, {name}! 💼",
    "The hustle continues, {name}. 🎯",
    "Midday check-in, {name}! ⚡",
    "Afternoon focus mode — {name}! 📊",
    "Still grinding, {name}? Nice. 🎯",
    "Almost there, {name}! ✨",
    "Afternoon power hour, {name}! 🌴",
  ],
  evening: [
    "{name} returns! 🌆",
    "One more push, {name}! ✅",
    "Evening mode: on. What's up, {name}? 🍃",
    "Wrapping up, {name}? 📋",
    "Almost the weekend, {name}! 🎉",
    "TGIF, {name}! Close it out strong. 🥂",
    "Saturday night hustle — {name}! 🌇",
  ],
}

// Sub-messages per slot, indexed by day of week
const MESSAGES = {
  lateNight: [
    "Late nights build empires, but so does sleep. Wrap up and recharge.",
    "The agency will still be here in the morning. Take care of yourself first.",
    "Even the best strategists need downtime. You've earned the break.",
    "Midnight grind mode: respect. But seriously, close the laptop soon.",
    "You're still at it? That's dedication. Don't forget to eat something too.",
    "The hustle is real tonight. Make sure tomorrow-you appreciates the effort.",
    "Great work waits for a rested mind. Seriously — go sleep.",
  ],
  morning: [
    "A fresh week starts today — let's set the tone.",
    "Monday energy: set your priorities and own the week.",
    "New day, clean slate. What's the one thing that moves the needle today?",
    "Mid-week momentum — you're past the hump, keep pushing.",
    "Almost there. Two more days and the weekend is yours.",
    "Close out the week strong and tie up any loose ends.",
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
    "Wrap up, log off, and actually disconnect this weekend.",
    "Saturday evening — you're dedicated. Don't burn out.",
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
      <div className="text-sm font-medium text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full border border-border/50 shadow-sm shrink-0">
        {format(time, 'EEEE, MMMM do')}
      </div>
    </div>
  )
}
