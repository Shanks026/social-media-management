/* eslint-disable react-hooks/incompatible-library, react-hooks/exhaustive-deps */
import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Building2, Loader2, CalendarDays, Link, Megaphone } from 'lucide-react'
import { useClients } from '@/api/clients'
import { createMeeting, updateMeeting } from '@/api/meetings'
import { fetchActiveCampaignsByClient } from '@/api/campaigns'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

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

const NONE = '__none__'

const formSchema = z.object({
  client_id: z.string({
    required_error: 'Client is required',
  }).min(1, 'Client is required'),
  campaign_id: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  datetime: z.string().min(1, 'Date and time are required'),
  notes: z.string().optional(),
  meeting_link: z.union([
    z.string().url('Please enter a valid URL'),
    z.literal(''),
  ]).optional(),
})

export default function CreateMeetingDialog({
  children,
  defaultClientId,
  lockClient = false,
  campaignId = null,    // locked campaign ID — no selector shown
  campaignName = null,  // display name for the locked campaign pill
  editMeeting,
  onSuccess,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? controlledOnOpenChange : setInternalOpen
  const queryClient = useQueryClient()

  const { data: clientsData, isLoading: loadingClients } = useClients()

  const allClients = React.useMemo(() => {
    if (!clientsData) return []
    return clientsData.realClients || []
  }, [clientsData])

  const defaultDate = new Date()
  defaultDate.setHours(defaultDate.getHours() + 1)
  defaultDate.setMinutes(0)
  defaultDate.setSeconds(0)

  const localDatetime = editMeeting?.datetime
    ? new Date(
        new Date(editMeeting.datetime).getTime() - new Date().getTimezoneOffset() * 60000,
      ).toISOString().slice(0, 16)
    : new Date(
        defaultDate.getTime() - defaultDate.getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client_id: editMeeting?.client_id || defaultClientId || '',
      campaign_id: editMeeting?.campaign_id || '',
      title: editMeeting?.title || '',
      datetime: localDatetime,
      notes: editMeeting?.notes || '',
      meeting_link: editMeeting?.meeting_link || '',
    },
  })

  const currentClientId = form.watch('client_id')
  const selectedClient = allClients.find((c) => c.id === currentClientId)

  // Fetch active campaigns for the selected client — only when campaign is not locked
  const { data: availableCampaigns = [], isLoading: loadingCampaigns } = useQuery({
    queryKey: ['campaigns', 'active-by-client', currentClientId],
    queryFn: () => fetchActiveCampaignsByClient(currentClientId),
    enabled: !!currentClientId && !campaignId,
  })

  React.useEffect(() => {
    if (open && editMeeting) {
      const editLocalDatetime = new Date(
        new Date(editMeeting.datetime).getTime() - new Date().getTimezoneOffset() * 60000,
      ).toISOString().slice(0, 16)

      form.reset({
        client_id: editMeeting.client_id || '',
        campaign_id: editMeeting.campaign_id || '',
        title: editMeeting.title || '',
        datetime: editLocalDatetime,
        notes: editMeeting.notes || '',
        meeting_link: editMeeting.meeting_link || '',
      })
    } else if (open && !editMeeting) {
      form.reset({
        client_id: defaultClientId || '',
        campaign_id: '',
        title: '',
        datetime: new Date(
          defaultDate.getTime() - defaultDate.getTimezoneOffset() * 60000,
        ).toISOString().slice(0, 16),
        notes: '',
        meeting_link: '',
      })
    }
  }, [open, editMeeting, defaultClientId])

  const mutationFn = editMeeting
    ? (payload) => updateMeeting(editMeeting.id, payload)
    : createMeeting

  const { mutate, isPending } = useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] })
      queryClient.invalidateQueries({ queryKey: ['upcomingMeetings'] })
      queryClient.invalidateQueries({ queryKey: ['todayMeetings'] })
      if (campaignId) {
        queryClient.invalidateQueries({ queryKey: ['campaign-meetings', campaignId] })
      }
      toast.success(editMeeting ? 'Meeting updated successfully' : 'Meeting scheduled successfully')
      setOpen(false)
      form.reset()
      if (onSuccess) onSuccess()
    },
    onError: (error) => {
      toast.error('Failed to save meeting: ' + error.message)
    },
  })

  function onSubmit(values) {
    const utcDate = new Date(values.datetime)
    // Locked campaignId takes precedence; otherwise use form selection (NONE sentinel → null)
    const effectiveCampaignId =
      campaignId ||
      (values.campaign_id && values.campaign_id !== NONE ? values.campaign_id : null)

    mutate({
      ...values,
      datetime: utcDate.toISOString(),
      campaign_id: effectiveCampaignId,
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        setOpen(val)
        if (!val) {
          form.reset()
        }
      }}
    >
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl">
            {editMeeting ? 'Edit Meeting' : 'Schedule Meeting'}
          </DialogTitle>
          <DialogDescription>
            {editMeeting
              ? 'Update the details for this client session.'
              : 'Fill in the details below to set up a new client session.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-6 py-4"
          >
            <div className="grid gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Client */}
                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Client</FormLabel>
                      {lockClient && selectedClient ? (
                        <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/40 text-sm">
                          <ClientAvatar client={selectedClient} />
                          <span className="font-medium text-foreground">
                            {selectedClient.name}
                          </span>
                          {selectedClient.is_internal && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0">
                              Internal
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <Select
                          disabled={loadingClients}
                          onValueChange={(val) => {
                            field.onChange(val)
                            // Reset campaign when client changes
                            form.setValue('campaign_id', '')
                          }}
                          value={field.value ? field.value : undefined}
                          defaultValue={field.value ? field.value : undefined}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-muted/30 w-full">
                              <SelectValue placeholder="Select client" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {allClients?.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                <div className="flex items-center gap-2">
                                  <ClientAvatar client={client} />
                                  <span className="truncate">{client.name}</span>
                                  {client.is_internal && (
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
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Date & Time */}
                <FormField
                  control={form.control}
                  name="datetime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">
                        Date & Time
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          className="bg-muted/30"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Campaign */}
              <FormField
                control={form.control}
                name="campaign_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">
                      Campaign{' '}
                      <span className="text-muted-foreground font-normal">(Optional)</span>
                    </FormLabel>
                    {campaignId ? (
                      // Locked — show read-only pill
                      <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/40 text-sm">
                        <Megaphone className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium text-foreground truncate">
                          {campaignName ?? 'Campaign'}
                        </span>
                      </div>
                    ) : (
                      <Select
                        disabled={!currentClientId || loadingCampaigns}
                        onValueChange={field.onChange}
                        value={field.value ? field.value : undefined}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-muted/30 w-full">
                            <SelectValue placeholder={
                              !currentClientId
                                ? 'Select a client first'
                                : availableCampaigns.length === 0
                                  ? 'No active campaigns'
                                  : 'Select campaign'
                            } />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE}>
                            <span className="text-muted-foreground">None</span>
                          </SelectItem>
                          {availableCampaigns.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              <div className="flex items-center gap-2">
                                <Megaphone className="size-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate">{c.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">
                      Meeting Title
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Q3 Strategy Review"
                        className="bg-muted/30 focus-visible:ring-primary"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">
                      Notes{' '}
                      <span className="text-muted-foreground font-normal">(Optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Agenda, goals, or preparation needed..."
                        className="min-h-[100px] resize-none bg-muted/30"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="meeting_link"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">
                      Meeting Link{' '}
                      <span className="text-muted-foreground font-normal">
                        (Optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          placeholder="https://meet.google.com/..."
                          className="bg-muted/30 pl-9"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                className="text-muted-foreground"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="px-8">
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CalendarDays className="mr-2 h-4 w-4" />
                )}
                {editMeeting ? 'Save Changes' : 'Schedule'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
