import { PencilRuler, Megaphone, ListTodo, CircleDollarSign, Percent } from 'lucide-react'

const TotalStatItem = ({ icon: Icon, count, label, valueClassName = 'text-foreground' }) => (
  <div className="flex items-center gap-1.5">
    <Icon className="size-3.5 text-muted-foreground shrink-0" />
    <span className={`text-xs font-bold ${valueClassName}`}>{count}</span>
    <span className="text-xs text-muted-foreground">{label}</span>
  </div>
)

const formatMRR = (val) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val)

/**
 * Deliverables/Campaigns/Tasks totals + MRR/Margin (external clients only,
 * each hidden independently when it has no real value).
 *
 * `section="all"` (default) — both groups side by side; used by ClientCard.
 * `section="financials"` — MRR/Margin only, no totals; used by
 * ClientProfileView, which shows the totals as counts on the tab labels
 * instead (Workflow/Tasks/Campaigns), so repeating them here would be redundant.
 */
export default function ClientMetricsRow({ client, section = 'all', className = 'pt-4' }) {
  const showFinancials = !client.is_internal
  const margin = client.profit_margin ?? 0
  const marginColorClass =
    margin === 0
      ? 'text-foreground'
      : margin >= 70
        ? 'text-emerald-500'
        : margin >= 40
          ? 'text-amber-500'
          : 'text-red-500'

  const financials =
    showFinancials && (client.avg_monthly_retainer > 0 || margin > 0) ? (
      <div className="flex items-center gap-5">
        {client.avg_monthly_retainer > 0 && (
          <TotalStatItem
            icon={CircleDollarSign}
            count={formatMRR(client.avg_monthly_retainer)}
            label="MRR"
          />
        )}
        {margin > 0 && (
          <TotalStatItem
            icon={Percent}
            count={`${margin}%`}
            label="Margin"
            valueClassName={marginColorClass}
          />
        )}
      </div>
    ) : null

  if (section === 'financials') {
    return (
      financials && (
        <div className={`${className} flex items-center gap-3`}>
          <div className="size-1 rounded-full bg-muted-foreground/30 shrink-0" />
          {financials}
        </div>
      )
    )
  }

  return (
    <div className={`${className} flex items-center justify-between gap-4`}>
      <div className="flex items-center gap-5">
        <TotalStatItem icon={PencilRuler} count={client.total_deliverables ?? 0} label="Deliverables" />
        <TotalStatItem icon={Megaphone} count={client.total_campaigns ?? 0} label="Campaigns" />
        <TotalStatItem icon={ListTodo} count={client.total_tasks ?? 0} label="Tasks" />
      </div>
      {financials ?? <div />}
    </div>
  )
}
