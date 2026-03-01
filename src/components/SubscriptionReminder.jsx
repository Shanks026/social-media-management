import { useEffect } from 'react'
import { useExpenses } from '@/api/expenses'
import { differenceInDays, startOfToday } from 'date-fns'
import { toast } from 'sonner'
import { AlertCircle } from 'lucide-react'

// Constants to prevent spamming
const REMINDER_KEY = 'subscription_reminders_last_shown'
const HOURS_COOLDOWN = 12

export function SubscriptionReminder() {
  const { data: allExpenses = [], isLoading } = useExpenses()
  
  useEffect(() => {
    if (isLoading || !allExpenses.length) return

    // 1. Check if we've shown reminders recently to avoid spam
    const lastShownStr = localStorage.getItem(REMINDER_KEY)
    if (lastShownStr) {
      const lastShown = new Date(parseInt(lastShownStr, 10))
      const hoursSince = (new Date() - lastShown) / (1000 * 60 * 60)
      if (hoursSince < HOURS_COOLDOWN) return
    }

    // 2. Identify due subscriptions 
    const today = startOfToday()
    const dueSubscriptions = allExpenses.filter((expense) => {
      // Only remind for active subscriptions
      if (!expense.is_active) return false

      const billDate = new Date(expense.next_billing_date)
      const daysUntilDue = differenceInDays(billDate, today)

      // Alert if due today, tomorrow, or in 2 days (48 hours)
      return daysUntilDue >= 0 && daysUntilDue <= 2
    })

    // 3. Show toasts if any are due
    if (dueSubscriptions.length > 0) {
      dueSubscriptions.forEach((sub) => {
        const days = differenceInDays(new Date(sub.next_billing_date), today)
        let timeText = ''
        if (days === 0) timeText = 'due today'
        else if (days === 1) timeText = 'due tomorrow'
        else timeText = `due in ${days} days`

        toast(
          <div className="flex items-start gap-3 w-full">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-medium">Upcoming Subscription</span>
              <span className="text-sm text-foreground/80">
                Your <span className="font-semibold text-foreground">{sub.name}</span> subscription is {timeText}.
              </span>
            </div>
          </div>
        , { duration: 8000 })
      })

      // Record when we showed the reminders
      localStorage.setItem(REMINDER_KEY, Date.now().toString())
    }
  }, [allExpenses, isLoading])

  // This is a logic-only component that lives in the background
  return null
}
