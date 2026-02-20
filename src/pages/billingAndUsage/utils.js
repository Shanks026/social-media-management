/**
 * Returns Tailwind class config based on a usage percentage.
 * Used by UsageCard to colour text, progress bar, and border.
 */
export const getStatusConfig = (percent) => {
  if (percent >= 100)
    return {
      text: 'text-destructive',
      progress: 'bg-destructive',
      border: 'border-l-4 border-l-destructive',
    }
  if (percent >= 80)
    return {
      text: 'text-amber-500',
      progress: 'bg-amber-500',
      border: 'border-l-4 border-l-amber-500',
    }
  return {
    text: 'text-primary',
    progress: 'bg-primary',
    border: 'border-none',
  }
}
