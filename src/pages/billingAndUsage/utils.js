export const getStatusConfig = (percent) => {
  if (percent >= 100)
    return {
      text: 'text-destructive',
      bg: 'bg-destructive/10',
      progress: 'bg-destructive',
    }
  if (percent >= 80)
    return {
      text: 'text-amber-500',
      bg: 'bg-amber-500/10',
      progress: 'bg-amber-500',
    }
  return {
    text: 'text-primary',
    bg: 'bg-primary/10',
    progress: 'bg-primary',
  }
}
