import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const SOURCE_CONFIG = {
  manual:        { label: 'Manual' },
  apollo:        { label: 'Apollo' },
  apify:         { label: 'Apify' },
  google_maps:   { label: 'Google Maps' },
  referral:      { label: 'Referral' },
  cold_outreach: { label: 'Cold Outreach' },
  instagram:     { label: 'Instagram' },
  linkedin:      { label: 'LinkedIn' },
  other:         { label: 'Other' },
}

export function ProspectSourceBadge({ source, className }) {
  const config = SOURCE_CONFIG[source] ?? { label: source ?? 'Manual' }
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium whitespace-nowrap bg-muted/60 text-muted-foreground border-transparent',
        className
      )}
    >
      {config.label}
    </Badge>
  )
}
