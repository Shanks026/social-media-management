import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import {
  Filter,
  Plus,
  Trash2,
  Search,
  FileText,
  Send,
  Eye,
  Pencil,
  MoreHorizontal,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Download,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import StatusBadge from '@/components/StatusBadge'

import { useInvoices, useUpdateInvoice, useDeleteInvoice } from '@/api/invoices'
import { useClients } from '@/api/clients'
import { formatCurrency } from '@/utils/finance'
import { cn } from '@/lib/utils'
import { CustomTable } from '@/components/CustomTable'
import { CreateInvoiceDialog } from './CreateInvoiceDialog'
import { EditInvoiceDialog } from './EditInvoiceDialog'
import { toast } from 'sonner'
import { useSubscription } from '@/api/useSubscription'
import { downloadInvoicePDF } from '@/utils/downloadInvoicePDF'
import { supabase } from '@/lib/supabase'

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
]

export default function InvoicesTab({ clientId, subTabs }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editInvoiceId, setEditInvoiceId] = useState(null)
  const [filterClient, setFilterClient] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')

  const { data: invoices = [], isLoading } = useInvoices({
    clientId,
    status: filterStatus !== 'ALL' ? filterStatus : undefined,
  })
  const { mutate: updateInvoice } = useUpdateInvoice()
  const { mutate: deleteInvoice } = useDeleteInvoice()
  const { data: clientData } = useClients()
  const clients = clientData?.realClients || []
  const { data: subscription } = useSubscription()

  // --- Quick Stats ---
  const stats = useMemo(() => {
    const outstanding = invoices
      .filter((inv) => inv.status === 'SENT' || inv.status === 'OVERDUE')
      .reduce((sum, inv) => sum + (inv.total || 0), 0)

    const overdue = invoices.filter((inv) => inv.status === 'OVERDUE').length
    const drafts = invoices.filter((inv) => inv.status === 'DRAFT').length
    const paid = invoices
      .filter((inv) => inv.status === 'PAID')
      .reduce((sum, inv) => sum + (inv.total || 0), 0)

    return { outstanding, overdue, drafts, paid }
  }, [invoices])

  // --- Status update handler ---
  const handleStatusChange = (id, newStatus) => {
    updateInvoice(
      { id, updates: { status: newStatus } },
      {
        onSuccess: () =>
          toast.success(`Invoice marked as ${newStatus.toLowerCase()}`),
        onError: (err) => toast.error(`Failed to update: ${err.message}`),
      },
    )
  }

  // --- Delete handler ---
  const handleDelete = (id) => {
    deleteInvoice(id, {
      onSuccess: () => toast.success('Invoice deleted'),
      onError: (err) => toast.error(`Failed to delete: ${err.message}`),
    })
  }

  // --- PDF download handler ---
  const handleDownloadPDF = async (invoice) => {
    try {
      // Fetch invoice items since the list query doesn't include them
      const { data: items, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('created_at', { ascending: true })

      if (error) throw error

      const fullInvoice = { ...invoice, items: items || [] }
      await downloadInvoicePDF(fullInvoice, subscription || {})
      toast.success('Invoice PDF downloaded')
    } catch (err) {
      console.error('PDF generation error:', err)
      toast.error('Failed to generate PDF')
    }
  }

  // --- Columns ---
  const columns = [
    {
      header: 'Invoice',
      width: '160px',
      headerClassName: 'pl-6',
      cellClassName: 'pl-6',
      render: (inv) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-mono text-sm font-medium">
            {inv.invoice_number}
          </span>
        </div>
      ),
    },
    ...(clientId
      ? []
      : [
          {
            header: 'Client',
            width: '20%',
            render: (inv) => (
              <div className="flex items-center gap-2">
                {inv.client?.logo_url ? (
                  <img
                    src={inv.client.logo_url}
                    className="w-4 h-4 rounded-full border border-border shrink-0"
                    alt=""
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground shrink-0">
                    {inv.client?.name?.[0]}
                  </div>
                )}
                <span className="text-sm text-muted-foreground truncate">
                  {inv.client?.name || 'Unknown'}
                </span>
              </div>
            ),
          },
        ]),
    {
      header: 'Issue Date',
      width: '130px',
      cellClassName: 'text-muted-foreground text-sm',
      render: (inv) =>
        inv.issue_date ? format(new Date(inv.issue_date), 'MMM d, yyyy') : '—',
    },
    {
      header: 'Due Date',
      width: '130px',
      cellClassName: 'text-sm',
      render: (inv) => {
        if (!inv.due_date) return '—'
        const isOverdue =
          inv.status !== 'PAID' && new Date(inv.due_date) < new Date()
        return (
          <span className={cn(isOverdue && 'text-rose-600 font-medium')}>
            {format(new Date(inv.due_date), 'MMM d, yyyy')}
          </span>
        )
      },
    },
    {
      header: 'Status',
      width: '130px',
      render: (inv) => <StatusBadge status={inv.status} />,
    },
    {
      header: 'Amount',
      width: '130px',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (inv) => (
        <span className="font-medium tabular-nums text-foreground">
          {formatCurrency(inv.total || 0)}
        </span>
      ),
    },
    {
      header: '',
      width: '60px',
      render: (inv) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 h-8 w-8 text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => setEditInvoiceId(inv.id)}>
              {inv.status === 'PAID' ? (
                <>
                  <Eye className="h-3.5 w-3.5 mr-2" /> View Invoice
                </>
              ) : (
                <>
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Invoice
                </>
              )}
            </DropdownMenuItem>
            {inv.status === 'DRAFT' && (
              <DropdownMenuItem
                onClick={() => handleStatusChange(inv.id, 'SENT')}
              >
                <Send className="h-3.5 w-3.5 mr-2" /> Mark as Sent
              </DropdownMenuItem>
            )}
            {(inv.status === 'SENT' || inv.status === 'OVERDUE') && (
              <DropdownMenuItem
                onClick={() => handleStatusChange(inv.id, 'PAID')}
              >
                <span className="h-3.5 w-3.5 mr-2">✓</span> Mark as Paid
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => handleDownloadPDF(inv)}>
              <Download className="h-3.5 w-3.5 mr-2" /> Download PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => handleDelete(inv.id)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  // --- Filtered data ---
  const filteredData = useMemo(() => {
    let data = invoices

    // Client filter (only when not scoped to a client)
    if (!clientId && filterClient !== 'ALL') {
      data = data.filter((inv) => inv.client_id === filterClient)
    }

    // Search filter
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      data = data.filter(
        (inv) =>
          inv.invoice_number?.toLowerCase().includes(lower) ||
          inv.client?.name?.toLowerCase().includes(lower) ||
          inv.notes?.toLowerCase().includes(lower),
      )
    }

    return data
  }, [invoices, filterClient, searchTerm, clientId])

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* --- Header Actions --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {subTabs ? (
          subTabs
        ) : (
          <span className="text-2xl font-normal">Invoices</span>
        )}

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative w-full md:w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              className="pl-9 border focus:border-solid transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px] border-dashed">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Filter className="h-3.5 w-3.5" />
                <SelectValue placeholder="Status" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Client Filter — hide when scoped to a client */}
          {!clientId && (
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-[160px] border-dashed">
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Filter className="h-3.5 w-3.5" />
                  <SelectValue placeholder="Client" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Clients</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Create Invoice Button */}
          <Button size="sm" onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4" /> New Invoice
          </Button>
        </div>
      </div>

      {/* --- Quick Stats (matches Overview style) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Outstanding */}
        <Card className="rounded-2xl border-none bg-card/50 shadow-sm ring-1 ring-border/50 dark:bg-card/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Outstanding
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {formatCurrency(stats.outstanding)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Sent & overdue invoices
            </p>
          </CardContent>
        </Card>

        {/* Collected */}
        <Card className="rounded-2xl border-none bg-card/50 shadow-sm ring-1 ring-border/50 dark:bg-card/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Collected
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {formatCurrency(stats.paid)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total paid invoices
            </p>
          </CardContent>
        </Card>

        {/* Overdue */}
        <Card className="rounded-2xl border-none bg-card/50 shadow-sm ring-1 ring-border/50 dark:bg-card/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Overdue
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              {stats.overdue}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Past due date</p>
          </CardContent>
        </Card>

        {/* Drafts */}
        <Card className="rounded-2xl border-none bg-card/50 shadow-sm ring-1 ring-border/50 dark:bg-card/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Drafts
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {stats.drafts}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Not yet sent</p>
          </CardContent>
        </Card>
      </div>

      {/* --- Table --- */}
      <CustomTable
        columns={columns}
        data={filteredData}
        isLoading={isLoading}
      />

      {/* --- Create Invoice Dialog --- */}
      <CreateInvoiceDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        preselectedClientId={clientId}
      />

      {/* --- Edit Invoice Dialog --- */}
      <EditInvoiceDialog
        open={!!editInvoiceId}
        onOpenChange={(open) => {
          if (!open) setEditInvoiceId(null)
        }}
        invoiceId={editInvoiceId}
      />
    </div>
  )
}
