import { Receipt } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export const InvoicesTab = () => (
  <Card className="border border-border/50 bg-card/30 rounded-2xl overflow-hidden">
    <CardContent className="p-0">
      <div className="flex flex-col items-center justify-center py-24">
        <div className="size-14 rounded-full bg-muted/50 flex items-center justify-center mb-5">
          <Receipt className="size-7 text-muted-foreground/60" />
        </div>
        <h3 className="text-base font-semibold tracking-tight">
          No invoices yet
        </h3>
        <p className="text-sm text-muted-foreground/70 mt-1.5 max-w-sm text-center font-normal leading-relaxed">
          Your invoice history will appear here once billing is active. All past
          and upcoming invoices will be available for download.
        </p>
      </div>
    </CardContent>
  </Card>
)
