import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Building2 } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { createCollection, updateCollection, documentKeys } from '@/api/documents'
import { useAuth } from '@/context/AuthContext'
import { useSubscription } from '@/api/useSubscription'

const baseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
})
const schemaWithClient = baseSchema.extend({
  clientId: z.string().min(1, 'Please select a client'),
})

/**
 * Dialog to create or rename a collection.
 *
 * Props:
 *   open              — boolean
 *   onOpenChange      — setter
 *   clientId          — UUID (pre-selected client; required when showClientSelector=false)
 *   editCollection    — existing collection object (for rename mode)
 *   showClientSelector — show a client picker field (for global Documents page)
 *   internalAccount   — { id, name, logo_url } workspace account
 *   realClients       — [{ id, name, logo_url }] client list
 *   defaultClientId   — pre-select this client in the picker
 */
export default function CreateCollectionDialog({
  open,
  onOpenChange,
  clientId,
  editCollection,
  showClientSelector = false,
  internalAccount,
  realClients = [],
  defaultClientId,
  onSuccess,
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: sub } = useSubscription()
  const effectiveOpen = open && (sub?.documents_collections ?? false)
  const isEdit = !!editCollection
  const schema = showClientSelector && !isEdit ? schemaWithClient : baseSchema

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', clientId: defaultClientId ?? '' },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: editCollection?.name ?? '',
        description: editCollection?.description ?? '',
        clientId: defaultClientId ?? '',
      })
    }
  }, [open, editCollection, defaultClientId, form])

  const resolvedClientId = (values) =>
    isEdit ? (editCollection?.client_id ?? clientId) : (values.clientId || clientId)

  const mutation = useMutation({
    mutationFn: (values) => {
      if (isEdit) {
        return updateCollection(editCollection.id, { name: values.name, description: values.description })
      }
      return createCollection({
        clientId: resolvedClientId(values),
        name: values.name,
        description: values.description || undefined,
      })
    },
    onSuccess: (_, values) => {
      const cid = resolvedClientId(values)
      queryClient.invalidateQueries({ queryKey: documentKeys.collections(cid) })
      queryClient.invalidateQueries({ queryKey: documentKeys.allCollections() })
      toast.success(isEdit ? 'Collection renamed' : 'Collection created')
      onOpenChange(false)
      if (!isEdit) onSuccess?.()
    },
    onError: (err) => toast.error(err.message || 'Something went wrong'),
  })

  return (
    <Dialog open={effectiveOpen} onOpenChange={mutation.isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Rename Collection' : 'New Collection'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">

            {/* Client selector — only on global page, create mode */}
            {showClientSelector && !isEdit && (
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={mutation.isPending}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a client…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {internalAccount && (
                          <SelectGroup>
                            <SelectLabel>Workspace</SelectLabel>
                            <SelectItem value={internalAccount.id}>
                              <span className="flex items-center gap-2">
                                {internalAccount.logo_url ? (
                                  <img
                                    src={internalAccount.logo_url}
                                    alt=""
                                    className="size-4 rounded-full object-cover"
                                  />
                                ) : (
                                  <Building2 className="size-4 text-muted-foreground" />
                                )}
                                {internalAccount.name}
                              </span>
                            </SelectItem>
                          </SelectGroup>
                        )}
                        {realClients.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>Clients</SelectLabel>
                            {realClients.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                <span className="flex items-center gap-2">
                                  {c.logo_url ? (
                                    <img
                                      src={c.logo_url}
                                      alt=""
                                      className="size-4 rounded-full object-cover"
                                    />
                                  ) : (
                                    <Building2 className="size-4 text-muted-foreground" />
                                  )}
                                  {c.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Brand Refresh 2025"
                      disabled={mutation.isPending}
                      {...field}
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
                  <FormLabel>Description <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What is this collection for?"
                      rows={2}
                      disabled={mutation.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : isEdit ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
