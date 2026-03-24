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
  RefreshCw,
  Lock,
  Megaphone,
  Receipt,
} from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import StatusBadge from '@/components/StatusBadge'

import {
  useInvoices,
  useUpdateInvoice,
  useDeleteInvoice,
  useRecurringInvoices,
  useDeleteRecurringInvoice,
  useGenerateFromRecurring,
} from '@/api/invoices'
import { useClients } from '@/api/clients'
import { formatCurrency } from '@/utils/finance'
import { cn } from '@/lib/utils'
import { CustomTable } from '@/components/CustomTable'
import { CreateInvoiceDialog } from './CreateInvoiceDialog'
import { EditInvoiceDialog } from './EditInvoiceDialog'
import { RecurringInvoiceDialog } from './RecurringInvoiceDialog'
import { toast } from 'sonner'
import { useSubscription } from '@/api/useSubscription'
import { downloadInvoicePDF } from '@/utils/downloadInvoicePDF'
import { supabase } from '@/lib/supabase'
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from '@/components/ui/empty'

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
]

export default function InvoicesTab({ clientId, subTabs }) {
  const [activeTab, setActiveTab] = useState('one-off')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editInvoiceId, setEditInvoiceId] = useState(null)

  const [isRecurringDialogOpen, setIsRecurringDialogOpen] = useState(false)
  const [editRecurringInvoice, setEditRecurringInvoice] = useState(null)

  const [filterClient, setFilterClient] = useState('ALL')
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

  // --- Delete handlers ---
  const handleDelete = (id) => {
    deleteInvoice(id, {
      onSuccess: () => toast.success('Invoice deleted'),
      onError: (err) => toast.error(`Failed to delete: ${err.message}`),
    })
  }

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

  // --- PDF download handler ---
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
      header: 'Category',
      width: '130px',
      cellClassName: 'text-muted-foreground text-sm',
      render: (inv) => inv.category || '—',
    },
    {
      header: 'Status',
      width: '130px',
      render: (inv) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={inv.status} />
          {inv.campaign_id && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  className="p-1 h-auto cursor-default"
                >
                  <Megaphone className="h-3 w-3" />
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Linked to campaign</TooltipContent>
            </Tooltip>
          )}
        </div>
      ),
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
    ...(clientId
      ? []
      : [
          {
            header: 'Client',
            width: '20%',
            headerClassName: 'pl-6',
            cellClassName: 'pl-6',
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
                <span className="text-sm text-foreground font-medium truncate">
                  {inv.client?.name || 'Unknown'}
                </span>
              </div>
            ),
          },
        ]),
    {
      header: 'Description',
      width: '25%',
      cellClassName: 'text-sm',
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
      width: '130px',
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
    let data = invoices

    if (!clientId && filterClient !== 'ALL') {
      data = data.filter((inv) => inv.client_id === filterClient)
    }

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

  const filteredRecurringData = useMemo(() => {
    let data = recurringInvoices.filter((inv) => inv.is_active)

    if (!clientId && filterClient !== 'ALL') {
      data = data.filter((inv) => inv.client_id === filterClient)
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      data = data.filter(
        (inv) =>
          inv.client?.name?.toLowerCase().includes(lower) ||
          inv.description?.toLowerCase().includes(lower) ||
          inv.category?.toLowerCase().includes(lower),
      )
    }

    return data
  }, [recurringInvoices, filterClient, searchTerm, clientId])

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="space-y-6 animate-in fade-in duration-500"
    >
      {/* --- Header Actions --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          {subTabs ? (
            subTabs
          ) : (
            <span className="text-3xl font-normal">Invoices</span>
          )}

          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="one-off" className="text-xs">
              One-off
            </TabsTrigger>
            {subscription?.finance_recurring_invoices ? (
              <TabsTrigger value="recurring" className="text-xs">
                Recurring
              </TabsTrigger>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value="recurring-locked"
                    disabled
                    className="text-xs opacity-50 cursor-not-allowed gap-1.5 disabled:pointer-events-auto"
                  >
                    Recurring
                    <Lock size={11} />
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>Available on Velocity & Quantum</TooltipContent>
              </Tooltip>
            )}
          </TabsList>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 md:flex-none md:w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-9 h-9 border focus:border-solid transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          {activeTab === 'one-off' && (
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px] h-9 border-dashed text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
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

          {/* Client Filter */}
          {!clientId && (
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-[140px] h-9 border-dashed text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
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

          {/* Create Button */}
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
        {/* --- Quick Stats --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

        {/* --- One-off Table --- */}
        {isLoading ? (
          <CustomTable columns={columns} data={[]} isLoading={true} />
        ) : filteredData.length === 0 ? (
          <Empty className="py-20 border border-dashed rounded-2xl bg-muted/5">
            <EmptyContent>
              <div className="text-4xl leading-none select-none mb-2">
                {searchTerm || filterStatus !== 'ALL' || filterClient !== 'ALL' ? '🔍' : '🧾'}
              </div>
              <EmptyHeader>
                <EmptyTitle className="font-normal text-xl">
                  {searchTerm ||
                  filterStatus !== 'ALL' ||
                  filterClient !== 'ALL'
                    ? 'No invoices found'
                    : 'No invoices yet'}
                </EmptyTitle>
                <EmptyDescription className="font-normal">
                  {searchTerm ||
                  filterStatus !== 'ALL' ||
                  filterClient !== 'ALL'
                    ? 'No invoices match your current filters. Try adjusting your search.'
                    : 'Generate your first invoice and start tracking client billing.'}
                </EmptyDescription>
              </EmptyHeader>
              {searchTerm ||
              filterStatus !== 'ALL' ||
              filterClient !== 'ALL' ? (
                <Button
                  variant="link"
                  onClick={() => {
                    setSearchTerm('')
                    setFilterStatus('ALL')
                    setFilterClient('ALL')
                  }}
                  className="text-primary font-medium"
                >
                  Clear filters
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDialogOpen(true)}
                >
                  <Plus className="size-4 mr-2" />
                  New Invoice
                </Button>
              )}
            </EmptyContent>
          </Empty>
        ) : (
          <CustomTable
            columns={columns}
            data={filteredData}
            isLoading={false}
          />
        )}
      </TabsContent>

      {subscription?.finance_recurring_invoices && (
        <TabsContent value="recurring" className="space-y-6 mt-0">
          {/* --- Recurring Table --- */}
          <CustomTable
            columns={recurringColumns}
            data={filteredRecurringData}
            isLoading={isRecurringLoading}
          />
        </TabsContent>
      )}

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
