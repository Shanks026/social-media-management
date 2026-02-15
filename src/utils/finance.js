import { CURRENCY } from './constants'
import { isWithinInterval } from 'date-fns'

export function formatCurrency(amount) {
  return new Intl.NumberFormat(CURRENCY.LOCALE, {
    style: 'currency',
    currency: CURRENCY.CODE,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Calculates financial metrics for a specific time period.
 *
 * @param {Object} params
 * @param {Array} params.transactions - List of transactions
 * @param {Array} params.expenses - List of recurring expenses (from expenses table)
 * @param {Array} params.oneOffTransactions - Transactions of type EXPENSE
 * @param {Date} params.periodStart - Start of period
 * @param {Date} params.periodEnd - End of period
 * @param {string} params.method - 'CASH' or 'ACCRUAL'
 *
 * @returns {Object} { revenue, expense, profit, margin, pending, overdue }
 */
/**
 * Calculates the monthly recurring cost from active expenses.
 * @param {Array} expenses - List of expense objects
 * @param {Date} dateLimit - The reference date (active if created before this)
 * @returns {number} Total monthly cost
 */
export function calculateRecurringBurn(expenses, dateLimit) {
  let total = 0
  expenses.forEach((e) => {
    const cost = parseFloat(e.cost) || 0
    const createdAt = new Date(e.created_at)

    // Only count if active at end of period
    if (createdAt <= dateLimit) {
      if (e.billing_cycle === 'MONTHLY') total += cost
      else if (e.billing_cycle === 'QUARTERLY') total += cost / 3
      else if (e.billing_cycle === 'YEARLY') total += cost / 12
    }
  })
  return total
}

export function calculatePeriodMetrics({
  transactions,
  expenses,
  periodStart,
  periodEnd,
  method = 'CASH',
}) {
  let revenue = 0
  let oneOffExpense = 0
  let pending = 0
  let overdue = 0

  // 1. Calculate Monthly Burn (Subscriptions)
  const monthlyRecurring = calculateRecurringBurn(expenses, periodEnd)

  // 2. Iterate Transactions
  transactions.forEach((t) => {
    const amount = parseFloat(t.amount) || 0
    const tDate = new Date(t.date) // Transaction Date

    // Global counters
    if (t.type === 'INCOME') {
      if (t.status === 'PENDING') pending += amount
      if (t.status === 'OVERDUE') overdue += amount
    }

    // Period specific
    if (isWithinInterval(tDate, { start: periodStart, end: periodEnd })) {
      if (t.type === 'INCOME') {
        if (method === 'ACCRUAL') {
          revenue += amount
        } else if (method === 'CASH' && t.status === 'PAID') {
          revenue += amount
        }
      } else if (t.type === 'EXPENSE') {
        oneOffExpense += amount
      }
    }
  })

  const totalExpense = oneOffExpense + monthlyRecurring
  const profit = revenue - totalExpense
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0

  return {
    revenue,
    expense: totalExpense,
    profit,
    margin,
    pending,
    overdue,
    monthlyRecurring,
  }
}
