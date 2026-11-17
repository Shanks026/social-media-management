import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { statusTone } from '@/lib/statusTone'
import * as deliverable from '@/lib/domain/deliverableStatus'
import * as client from '@/lib/domain/clientStatus'
import * as invoice from '@/lib/domain/invoiceStatus'
import * as transaction from '@/lib/domain/transactionStatus'

const titleCase = (v) => (v ? v[0] + v.slice(1).toLowerCase() : '')

// Label source per entity: its domain module. Never a map in this file.
const LABEL_FOR = {
  deliverable: deliverable.statusLabel,
  client: client.statusLabel,
  invoice: invoice.statusLabel,
  transaction: transaction.statusLabel,
  cadence: titleCase,
}

/**
 * A status pill. `entity` picks the vocabulary (default: Deliverable);
 * `audience="client"` uses the client-facing Deliverable labels.
 */
export default function StatusBadge({ status, entity = 'deliverable', audience, className }) {
  const tone = statusTone(entity, status)
  const Icon = tone.icon
  const label =
    entity === 'deliverable' && audience === 'client'
      ? deliverable.clientStatusLabel(status)
      : (LABEL_FOR[entity] ?? titleCase)(status)

  return (
    <Badge
      variant="none"
      className={cn(
        'flex items-center gap-2 rounded-full px-2.5 py-1 border-none shadow-none transition-colors',
        tone.badge,
        className,
      )}
    >
      {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
      <span className="text-xs font-semibold whitespace-nowrap">{label}</span>
    </Badge>
  )
}
