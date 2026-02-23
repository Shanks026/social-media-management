import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
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
import { Loader2 } from 'lucide-react'

const formSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  title: z.string().min(1, 'Title is required'),
  datetime: z.string().min(1, 'Date and time are required'),
  notes: z.string().optional(),
})

export default function CreateMeetingDialog({ 
  children, 
  defaultClientId, 
  onSuccess 
}) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading: loadingClients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => fetchClients()
  })
  const clients = data?.clients || []

  // Set default values including now to next top of hour roughly
  const defaultDate = new Date()
  defaultDate.setHours(defaultDate.getHours() + 1)
  defaultDate.setMinutes(0)
  defaultDate.setSeconds(0)
  
  // input datetime-local expects YYYY-MM-DDThh:mm format in local time
  const localDatetime = new Date(defaultDate.getTime() - defaultDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

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
    }
  })

  function onSubmit(values) {
    const utcDate = new Date(values.datetime)
    
    create({
      client_id: values.client_id,
      title: values.title,
      datetime: utcDate.toISOString(),
      notes: values.notes,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val)
      if (!val) {
        form.reset()
      } else {
         if (defaultClientId) {
            form.setValue('client_id', defaultClientId)
         }
      }
    }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Schedule Meeting</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select 
                    disabled={!!defaultClientId || loadingClients} 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a client" />
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
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meeting Title</FormLabel>
                  <FormControl>
                    <Input placeholder="E.g., Monthly Check-in" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="datetime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date & Time</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
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
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any agenda or specific notes..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Schedule
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
