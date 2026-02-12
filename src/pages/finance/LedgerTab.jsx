import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import {
  Filter,
  Plus,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  Building2,
  Search,
  Edit2,
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
import StatusBadge from '@/components/StatusBadge'

import { useTransactions, useDeleteTransaction } from '@/api/transactions'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { AddTransactionDialog } from './AddTransactionDialog'
import { CustomTable } from '@/components/CustomTable'

function useClientsList() {
  return useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, logo_url, is_internal') // Added is_internal

      const internalAccount = data?.find((c) => c.is_internal) || null
      const realClients = data?.filter((c) => !c.is_internal) || []

      return { internalAccount, realClients }
    },
  })
}

export default function LedgerTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [filterMode, setFilterMode] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')

  const { data: transactions = [], isLoading } = useTransactions()
  const { mutate: deleteTransaction } = useDeleteTransaction()
  const { data: clientData } = useClientsList()
  const clients = clientData?.realClients || []
  const internalAccount = clientData?.internalAccount

  // 1. Define Columns configuration
  const columns = [
    {
      header: 'Date',
      width: '140px', // Fixed width for dates
      headerClassName: 'pl-6',
      cellClassName: 'pl-6 text-muted-foreground font-light text-sm',
      render: (t) => format(new Date(t.date), 'MMM d, yyyy'),
    },
    {
      header: '',
      width: '50px', // Icon column
      render: (t) =>
        t.type === 'INCOME' ? (
          <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 w-fit">
            <ArrowDownLeft className="h-3.5 w-3.5" />
          </div>
        ) : (
          <div className="p-1.5 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/10 w-fit">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </div>
        ),
    },
    {
      header: 'Description',
      width: '25%', // Flexible percentage
      cellClassName: 'font-medium text-foreground',
      key: 'description',
    },
    {
      header: 'Account',
      width: '20%', // Flexible percentage
      render: (t) =>
        t.client?.is_internal || !t.client_id ? (
          <Badge
            variant="secondary"
            className="bg-primary/5 text-primary border-primary/10 font-medium px-2 py-0.5"
          >
            <Building2 className="mr-1.5 h-3 w-3" /> My Agency
          </Badge>
        ) : (
          <div className="flex items-center gap-2">
            {t.client?.logo_url && (
              <img
                src={t.client.logo_url}
                className="w-4 h-4 rounded-full border border-border shrink-0"
                alt=""
              />
            )}
            <span className="text-sm text-muted-foreground truncate">
              {t.client?.name}
            </span>
          </div>
        ),
    },
    {
      header: 'Category',
      width: '150px',
      render: (t) => (
        <Badge
          variant="secondary"
          className="font-normal text-xs bg-muted/50 text-muted-foreground"
        >
          {t.category}
        </Badge>
      ),
    },
    {
      header: 'Status',
      width: '120px',
      render: (t) => <StatusBadge status={t.status} />,
    },
    {
      header: 'Amount',
      width: '140px',
      headerClassName: 'text-right pr-6',
      cellClassName: 'text-right pr-6',
      render: (t) => (
        <span
          className={cn(
            'font-medium',
            t.type === 'INCOME' ? 'text-emerald-600' : 'text-foreground',
          )}
        >
          {t.type === 'INCOME' ? '+' : '-'}{' '}
          {new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
          }).format(t.amount)}
        </span>
      ),
    },
    {
      header: '',
      width: '80px', // Action buttons
      render: (t) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              setEditingTransaction(t)
              setIsDialogOpen(true)
            }}
            className="opacity-0 group-hover:opacity-100 h-8 w-8 text-muted-foreground"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              deleteTransaction(t.id)
            }}
            className="opacity-0 group-hover:opacity-100 h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  // (Filter logic stays the same)
  const filteredData = useMemo(() => {
    let data = transactions

    // 1. Account Filter
    if (filterMode === 'ALL') {
      // Keep as is
    } else if (
      filterMode === 'INTERNAL' ||
      filterMode === internalAccount?.id
    ) {
      // Filter by the internal UUID or null (for legacy data)
      data = data.filter(
        (t) => t.client_id === internalAccount?.id || t.client_id === null,
      )
    } else {
      data = data.filter((t) => t.client_id === filterMode)
    }

    // 2. Search Filter
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      data = data.filter(
        (t) =>
          t.description.toLowerCase().includes(lower) ||
          t.category.toLowerCase().includes(lower),
      )
    }

    return data
  }, [transactions, filterMode, searchTerm, internalAccount])

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* HEADER ACTIONS STAYS THE SAME */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Bar */}

        <span className="text-2xl font-normal">Ledger - Transactions</span>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search description..."
              className="pl-9 border focus:border-solid transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {/* Client Filter */}
          <Select value={filterMode} onValueChange={setFilterMode}>
            <SelectTrigger className="w-[180px] border-dashed">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Filter className="h-3.5 w-3.5" />
                <SelectValue placeholder="Filter View" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Expenses</SelectItem>
              <SelectItem value={internalAccount?.id || 'INTERNAL'}>
                Internal (My Agency)
              </SelectItem>
              {clients.length > 0 && (
                <div className="h-px bg-border my-2 mx-1" />
              )}
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Add Button */}
          <Button size="sm" onClick={() => setIsDialogOpen(true)} className="">
            <Plus className="h-4 w-4" /> Record
          </Button>
        </div>
      </div>

      <CustomTable
        columns={columns}
        data={filteredData}
        isLoading={isLoading}
      />

      <AddTransactionDialog
        open={isDialogOpen}
        onOpenChange={(val) => {
          setIsDialogOpen(val)
          if (!val) setEditingTransaction(null)
        }}
        editingData={editingTransaction}
      />
    </div>
  )
}
