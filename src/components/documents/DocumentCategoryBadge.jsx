import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const CATEGORY_STYLES = {
  // Client categories
  'Contract':         'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'NDA':              'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'Brand Guidelines': 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  'Creative Brief':   'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'Brand Assets':     'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Meeting Notes':    'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  'Invoice / Finance':'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'SOP':              'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  // Prospect categories
  'Pitch Deck':       'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  'Case Study':       'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  'Discovery Notes':  'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  // Shared
  'Other':            'bg-muted text-muted-foreground',
}

export default function DocumentCategoryBadge({ category, className }) {
  const style = CATEGORY_STYLES[category] ?? CATEGORY_STYLES['Other']
  return (
    <Badge
      variant="outline"
      className={cn(
        'border-0 text-xs font-medium px-2 py-0.5',
        style,
        className,
      )}
    >
      {category}
    </Badge>
  )
}
