import React from 'react'
import { INDUSTRY_OPTIONS } from '../../lib/industries'
import { Badge } from '@/components/ui/badge'

const IndustryBadge = ({ industryValue }) => {
  if (!industryValue) return null

  const industryOption = INDUSTRY_OPTIONS.find(
    (opt) => opt.value === industryValue,
  )

  const displayLabel = industryOption ? industryOption.label : industryValue
  const color = industryOption ? industryOption.color : 'gray'

  // Mapping with Dark Mode support:
  // Light: bg-100/text-700
  // Dark: bg-500/10 (10% opacity) / text-400
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
    indigo:
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400',
    slate:
      'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400',
    emerald:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    pink: 'bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
    amber:
      'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    teal: 'bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400',
    orange:
      'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
    cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400',
    violet:
      'bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400',
    fuchsia:
      'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/10 dark:text-fuchsia-400',
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400',
  }

  const selectedColorClass = colorClasses[color] || colorClasses.gray

  return (
    <Badge
      variant="secondary" // Use secondary as a base to avoid default primary styles
      className={`
        truncate px-2 py-0.5 rounded-lg border-none shadow-none
        !font-medium text-[11px] tracking-wider
        ${selectedColorClass}
      `}
    >
      {displayLabel}
    </Badge>
  )
}

export default IndustryBadge
