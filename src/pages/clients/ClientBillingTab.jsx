import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import {
  Plus,
  FileText,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Eye,
  Pencil,
  MoreHorizontal,
  Send,
  Download,
  Trash2,
  Search,
  Filter,
  RefreshCw,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import StatusBadge from '@/components/StatusBadge'
import { CustomTable } from '@/components/CustomTable'
import { cn } from '@/lib/utils'

import {
  useInvoices,
  useUpdateInvoice,
  useDeleteInvoice,
  useRecurringInvoices,
  useDeleteRecurringInvoice,
  useGenerateFromRecurring,
} from '@/api/invoices'
import { useSubscription } from '@/api/useSubscription'
import { formatCurrency } from '@/utils/finance'
import { CreateInvoiceDialog } from '@/pages/finance/CreateInvoiceDialog'
import { EditInvoiceDialog } from '@/pages/finance/EditInvoiceDialog'
import { RecurringInvoiceDialog } from '@/pages/finance/RecurringInvoiceDialog'
import { downloadInvoicePDF } from '@/utils/downloadInvoicePDF'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
]

export function ClientBillingTab({ clientId }) {
  const [activeTab, setActiveTab] = useState('one-off')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editInvoiceId, setEditInvoiceId] = useState(null)

  const [isRecurringDialogOpen, setIsRecurringDialogOpen] = useState(false)
  const [editRecurringInvoice, setEditRecurringInvoice] = useState(null)

  const [filterStatus, setFilterStatus] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')

  const { data: invoices = [], isLoading } = useInvoices({
    clientId,
    status: filterStatus !== 'ALL' ? filterStatus : undefined,
  })

  const { data: recurringInvoices = [], isLoading: isRecurringLoading } =
    useRecurringInvoices({ clientId })

  const { mutate: updateInvoice } = useUpdateInvoice()
  const { mutate: deleteInvoice } = useDeleteInvoice()

  const { mutate: deleteRecurring } = useDeleteRecurringInvoice()
  const { mutate: generateInvoice } = useGenerateFromRecurring()

  const { data: subscription } = useSubscription()

  // --- Summary stats ---
  const stats = useMemo(() => {
    const totalCollected = invoices
      .filter((inv) => inv.status === 'PAID')
      .reduce((sum, inv) => sum + (inv.total || 0), 0)

    const outstanding = invoices
      .filter((inv) => inv.status === 'SENT' || inv.status === 'OVERDUE')
      .reduce((sum, inv) => sum + (inv.total || 0), 0)

    const overdue = invoices.filter((inv) => inv.status === 'OVERDUE').length
    const drafts = invoices.filter((inv) => inv.status === 'DRAFT').length

    return { totalCollected, outstanding, overdue, drafts }
  }, [invoices])

  // --- Handlers (One-off) ---
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

  const handleDelete = (id) => {
    deleteInvoice(id, {
      onSuccess: () => toast.success('Invoice deleted'),
      onError: (err) => toast.error(`Failed to delete: ${err.message}`),
    })
  }

  // --- Handlers (Recurring) ---
  const handleDeleteRecurring = (id) => {
    deleteRecurring(id, {
      onSuccess: () => toast.success('Recurring template deleted'),
      onError: (err) => toast.error(`Failed to delete: ${err.message}`),
    })
  }

  const handleGenerateInvoice = (id) => {
    generateInvoice(id, {
      onSuccess: (newInvoice) => {
        toast.success('Invoice generated successfully from template')
        if (newInvoice?.id) {
          setActiveTab('one-off')
          setEditInvoiceId(newInvoice.id)
        }
      },
      onError: (err) => toast.error(`Failed to generate: ${err.message}`),
    })
  }

  const handleDownloadPDF = async (invoice) => {
    try {
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

  // --- Columns (One-off) ---
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

  // --- Columns (Recurring) ---
  const recurringColumns = [
    {
      header: 'Description',
      width: '25%',
      headerClassName: 'pl-6',
      cellClassName: 'pl-6 text-sm',
      render: (inv) => inv.description || inv.category,
    },
    {
      header: 'Amount',
      width: '130px',
      render: (inv) => (
        <span className="font-medium tabular-nums text-foreground">
          {formatCurrency(inv.amount || 0)}
        </span>
      ),
    },
    {
      header: 'Cycle',
      width: '120px',
      cellClassName: 'text-muted-foreground text-sm capitalize',
      render: (inv) => inv.billing_cycle.toLowerCase(),
    },
    {
      header: 'Next Invoice',
      width: '130px',
      cellClassName: 'text-sm',
      render: (inv) => {
        if (!inv.next_invoice_date) return '—'
        const isPast = new Date(inv.next_invoice_date) < new Date()
        return (
          <span className={cn(isPast && 'text-amber-600 font-medium')}>
            {format(new Date(inv.next_invoice_date), 'MMM d, yyyy')}
          </span>
        )
      },
    },
    {
      header: 'Last Gen',
      width: '110px',
      cellClassName: 'text-xs text-muted-foreground',
      render: (inv) =>
        inv.last_generated_at
          ? format(new Date(inv.last_generated_at), 'MMM d, yyyy')
          : 'Never',
    },
    {
      header: 'Status',
      width: '120px',
      render: (inv) => (
        <Badge
          variant="secondary"
          className={cn(
            inv.is_active &&
              'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20',
          )}
        >
          {inv.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      header: '',
      width: '120px',
      render: (inv) => (
        <Button
          variant="secondary"
          size="sm"
          className="h-8 text-xs font-medium w-auto"
          onClick={(e) => {
            e.stopPropagation()
            handleGenerateInvoice(inv.id)
          }}
        >
          <RefreshCw className="h-3 w-3 mr-1.5" />
          Generate
        </Button>
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
            <DropdownMenuItem onClick={() => setEditRecurringInvoice(inv)}>
              <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Template
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => handleDeleteRecurring(inv.id)}
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
    if (!searchTerm) return invoices
    const lower = searchTerm.toLowerCase()
    return invoices.filter(
      (inv) =>
        inv.invoice_number?.toLowerCase().includes(lower) ||
        inv.notes?.toLowerCase().includes(lower),
    )
  }, [invoices, searchTerm])

  const filteredRecurringData = useMemo(() => {
    const activeInvoices = (recurringInvoices || []).filter(
      (item) => item.is_active,
    )
    if (!searchTerm) return activeInvoices
    const lower = searchTerm.toLowerCase()
    return activeInvoices.filter(
      (inv) =>
        inv.description?.toLowerCase().includes(lower) ||
        inv.category?.toLowerCase().includes(lower),
    )
  }, [recurringInvoices, searchTerm])

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="space-y-6 animate-in fade-in duration-500 mt-4"
    >
      {/* --- Toolbar --- */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="one-off" className="text-xs">
            One-off Invoices
          </TabsTrigger>
          <TabsTrigger value="recurring" className="text-xs">
            Recurring Templates
          </TabsTrigger>
        </TabsList>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              className="pl-9 h-9 border focus:border-solid transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {activeTab === 'one-off' && (
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px] h-9 border-dashed text-xs">
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
          )}

          {activeTab === 'one-off' ? (
            <Button
              size="sm"
              className="h-9"
              onClick={() => setIsDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" /> New Invoice
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-9"
              onClick={() => setIsRecurringDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" /> New Template
            </Button>
          )}
        </div>
      </div>

      <TabsContent value="one-off" className="space-y-6 mt-0">
        {/* --- Summary Cards --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-none bg-card/50 shadow-sm ring-1 ring-border/50 dark:bg-card/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Collected
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {formatCurrency(stats.totalCollected)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Paid invoices
              </p>
            </CardContent>
          </Card>

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
                Sent &amp; overdue
              </p>
            </CardContent>
          </Card>

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
              <p className="text-xs text-muted-foreground mt-1">
                Past due date
              </p>
            </CardContent>
          </Card>

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

        {/* --- Invoice Table --- */}
        <CustomTable
          columns={columns}
          data={filteredData}
          isLoading={isLoading}
        />
      </TabsContent>

      <TabsContent value="recurring" className="space-y-6 mt-0">
        <CustomTable
          columns={recurringColumns}
          data={filteredRecurringData}
          isLoading={isRecurringLoading}
        />
      </TabsContent>

      {/* --- Dialogs --- */}
      <CreateInvoiceDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        preselectedClientId={clientId}
      />

      <EditInvoiceDialog
        open={!!editInvoiceId}
        onOpenChange={(open) => {
          if (!open) setEditInvoiceId(null)
        }}
        invoiceId={editInvoiceId}
        disableClientSelect={true}
      />

      <RecurringInvoiceDialog
        open={isRecurringDialogOpen}
        onOpenChange={setIsRecurringDialogOpen}
        preselectedClientId={clientId}
      />

      <RecurringInvoiceDialog
        open={!!editRecurringInvoice}
        onOpenChange={(open) => {
          if (!open) setEditRecurringInvoice(null)
        }}
        recurringInvoice={editRecurringInvoice}
      />
    </Tabs>
  )
}
