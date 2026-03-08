import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { format } from 'date-fns'
import { CalendarIcon, Loader2, Building2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import { useCreateCampaign, useUpdateCampaign } from '@/api/campaigns'
import { useClients } from '@/api/clients'

function ClientAvatar({ client }) {
  if (client?.logo_url) {
    return (
      <img
        src={client.logo_url}
        alt=""
        className="size-4 rounded object-cover ring-1 ring-border shrink-0"
      />
    )
  }
  return (
    <div className="size-4 rounded bg-muted flex items-center justify-center shrink-0">
      <Building2 className="size-2.5 text-muted-foreground" />
    </div>
  )
}

const schema = z
  .object({
    name: z.string().min(1, 'Campaign name is required'),
    goal: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    budget: z.coerce.number().positive('Must be a positive number').optional().nullable(),
    start_date: z.date().optional().nullable(),
    end_date: z.date().optional().nullable(),
    status: z.enum(['Active', 'Completed', 'Archived']).default('Active'),
    client_id: z.string().optional(),
  })
  .refine(
    ({ start_date, end_date }) =>
      !(start_date && end_date) || end_date >= start_date,
    { message: 'End date must be on or after start date', path: ['end_date'] },
  )

export function CampaignDialog({ open, onOpenChange, clientId, initialData }) {
  const isEdit = !!initialData
  const needsClientSelect = !clientId && !isEdit
  const createCampaign = useCreateCampaign()
  const updateCampaign = useUpdateCampaign()
  const { data: clientsData } = useClients()

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      goal: '',
      description: '',
      budget: null,
      start_date: null,
      end_date: null,
      status: 'Active',
      client_id: '',
    },
  })

  useEffect(() => {
    if (open) {
      if (initialData) {
        form.reset({
          name: initialData.name ?? '',
          goal: initialData.goal ?? '',
          description: initialData.description ?? '',
          budget: initialData.budget ?? null,
          start_date: initialData.start_date
            ? new Date(initialData.start_date)
            : null,
          end_date: initialData.end_date
            ? new Date(initialData.end_date)
            : null,
          status: initialData.status ?? 'Active',
        })
      } else {
        form.reset({
          name: '',
          goal: '',
          description: '',
          budget: null,
          start_date: null,
          end_date: null,
          status: 'Active',
          client_id: '',
        })
      }
    }
  }, [open, initialData, form])

  async function onSubmit(values) {
    const effectiveClientId = clientId || values.client_id
    if (!isEdit && !effectiveClientId) {
      form.setError('client_id', { message: 'Please select a client' })
      return
    }
    try {
      const payload = {
        name: values.name,
        goal: values.goal || null,
        description: values.description || null,
        budget: values.budget ?? null,
        start_date: values.start_date
          ? format(values.start_date, 'yyyy-MM-dd')
          : null,
        end_date: values.end_date
          ? format(values.end_date, 'yyyy-MM-dd')
          : null,
        status: values.status,
      }

      if (isEdit) {
        await updateCampaign.mutateAsync({ id: initialData.id, ...payload })
        toast.success('Campaign updated')
      } else {
        await createCampaign.mutateAsync({ ...payload, client_id: effectiveClientId })
        toast.success('Campaign created')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    }
  }

  const isPending = createCampaign.isPending || updateCampaign.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Campaign' : 'New Campaign'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {needsClientSelect && (
              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Client</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value ? field.value : undefined}
                        defaultValue={field.value ? field.value : undefined}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clientsData?.internalAccount && (
                            <SelectItem value={clientsData.internalAccount.id}>
                              <div className="flex items-center gap-2">
                                <ClientAvatar client={clientsData.internalAccount} />
                                <span className="truncate">{clientsData.internalAccount.name}</span>
                                <Badge
                                  variant="secondary"
                                  className="text-[9px] px-1 py-0 ml-1"
                                >
                                  Internal
                                </Badge>
                              </div>
                            </SelectItem>
                          )}
                          {clientsData?.realClients?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              <div className="flex items-center gap-2">
                                <ClientAvatar client={c} />
                                <span className="truncate">{c.name}</span>
                                {c.is_internal && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[9px] px-1 py-0 ml-1"
                                  >
                                    Internal
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
            )}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaign Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Campaign name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="goal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Goal</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Drive 500 sign-ups"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional notes about this campaign"
                      rows={2}
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="budget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Budget</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 50000"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? null : e.target.value)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !field.value && 'text-muted-foreground',
                            )}
                          >
                            <CalendarIcon className="mr-2 size-4" />
                            {field.value
                              ? format(field.value, 'MMM d, yyyy')
                              : 'Pick date'}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !field.value && 'text-muted-foreground',
                            )}
                          >
                            <CalendarIcon className="mr-2 size-4" />
                            {field.value
                              ? format(field.value, 'MMM d, yyyy')
                              : 'Pick date'}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Status only shown in edit mode */}
            {isEdit && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {isEdit ? 'Save Changes' : 'Create Campaign'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
