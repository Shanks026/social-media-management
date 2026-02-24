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
import { fetchClients } from '@/api/clients'
import { createMeeting } from '@/api/meetings'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, CalendarDays } from 'lucide-react'

const formSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  title: z.string().min(1, 'Title is required'),
  datetime: z.string().min(1, 'Date and time are required'),
  notes: z.string().optional(),
})

export default function CreateMeetingDialog({
  children,
  defaultClientId,
  onSuccess,
}) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading: loadingClients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => fetchClients(),
  })
  const clients = data?.clients || []

  const defaultDate = new Date()
  defaultDate.setHours(defaultDate.getHours() + 1)
  defaultDate.setMinutes(0)
  defaultDate.setSeconds(0)

  const localDatetime = new Date(
    defaultDate.getTime() - defaultDate.getTimezoneOffset() * 60000,
  )
    .toISOString()
    .slice(0, 16)

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client_id: defaultClientId || '',
      title: '',
      datetime: localDatetime,
      notes: '',
    },
  })

  const { mutate: create, isPending } = useMutation({
    mutationFn: createMeeting,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] })
      queryClient.invalidateQueries({ queryKey: ['upcomingMeeting'] })
      queryClient.invalidateQueries({ queryKey: ['todayMeetings'] })
      toast.success('Meeting scheduled successfully')
      setOpen(false)
      form.reset()
      if (onSuccess) onSuccess()
    },
    onError: (error) => {
      toast.error('Failed to schedule meeting: ' + error.message)
    },
  })

  function onSubmit(values) {
    const utcDate = new Date(values.datetime)
    create({
      ...values,
      datetime: utcDate.toISOString(),
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        setOpen(val)
        if (!val) form.reset()
        else if (defaultClientId) form.setValue('client_id', defaultClientId)
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      {/* Slightly wider dialog for better desktop appearance */}
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl">Schedule Meeting</DialogTitle>
          <DialogDescription>
            Fill in the details below to set up a new client session.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-6 py-4"
          >
            <div className="grid gap-5">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">
                        Client
                      </FormLabel>
                      <Select
                        disabled={!!defaultClientId || loadingClients}
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-muted/30 w-full">
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients?.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">
                      Notes (Optional)
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
                Schedule
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
