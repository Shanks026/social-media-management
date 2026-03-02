import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Building2, FileText, ArrowUpRight } from 'lucide-react'
import { useInvoices } from '@/api/invoices'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/utils/finance'

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import StatusBadge from '@/components/StatusBadge'
import { CustomTable } from '@/components/CustomTable'

export default function DashboardInvoiceTable() {
  const navigate = useNavigate()
  const { data: invoices = [], isLoading: isLoadingInvoices } = useInvoices()

  const { data: clientData = [] } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, logo_url, is_internal')
      return data || []
    },
  })

  // Merge client data into invoices
  const tableData = invoices
    .map((inv) => {
      const client = Array.isArray(clientData) 
        ? clientData.find((c) => c.id === inv.client_id)
        : null
      return {
        ...inv,
        client,
      }
    })
    .sort((a, b) => new Date(b.issue_date) - new Date(a.issue_date))
    .slice(0, 5) // Show top 5 most recent

  const columns = [
    {
      header: 'Invoice #',
      width: '20%',
      headerClassName: 'pl-6',
      cellClassName: 'font-medium pl-6',
      render: (inv) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{inv.invoice_number}</span>
        </div>
      ),
    },
    {
      header: 'Client',
      width: '30%',
      render: (inv) =>
        inv.client && !inv.client.is_internal ? (
          <div className="flex items-center gap-2">
            {inv.client.logo_url && (
              <img
                src={inv.client.logo_url}
                className="h-5 w-5 rounded-full object-cover"
                alt="Client Logo"
              />
            )}
            <span className="text-sm truncate">{inv.client.name}</span>
          </div>
        ) : (
          <Badge
            variant="secondary"
            className="bg-primary/5 text-primary border-primary/10"
          >
            <Building2 className="mr-1 h-3 w-3" /> My Agency
          </Badge>
        ),
    },
    {
      header: 'Issue Date',
      width: '20%',
      render: (inv) => format(new Date(inv.issue_date), 'MMM d, yyyy'),
    },
    {
      header: 'Amount',
      width: '15%',
      render: (inv) => <span className="font-semibold">{formatCurrency(inv.total)}</span>,
    },
    {
      header: 'Status',
      width: '15%',
      headerClassName: 'text-right pr-6',
      cellClassName: 'text-right pr-6',
      render: (inv) => (
        <div className="flex justify-end">
           <StatusBadge status={inv.status} />
        </div>
      ),
    },
  ]

  return (
    <Card className="rounded-2xl border-none shadow-sm flex flex-col h-full bg-card/50 dark:bg-card/20 ring-1 ring-border/50">
      <CardHeader className="pb-2 shrink-0 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-medium tracking-normal text-foreground">
            Recent Invoices
          </CardTitle>
          <p className="text-sm text-muted-foreground font-light">
            Latest billed items across all clients
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs font-medium"
          onClick={() => navigate('/finance/overview?tab=invoices')}
        >
          View All <ArrowUpRight className="ml-1 h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden px-6 rounded-b-2xl">
        <CustomTable
          columns={columns}
          data={tableData}
          isLoading={isLoadingInvoices}
          emptyMessage="No recent invoices found."
          emptyIcon={FileText}
          onRowClick={(row) => navigate(`/finance/overview?tab=invoices&invoiceId=${row.id}`)}
        />
      </CardContent>
    </Card>
  )
}
