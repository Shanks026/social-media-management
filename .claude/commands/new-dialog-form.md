# Command: New Dialog Form

Scaffold a form inside a shadcn Dialog (the dominant pattern for create/edit actions in this app).

## Usage

```
/new-dialog-form <EntityName>
```

## What to Generate

```jsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { create<EntityName> } from '@/api/<domain>'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  // add fields
})

export function Create<EntityName>Dialog() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  })

  async function onSubmit(values) {
    try {
      await create<EntityName>(values)
      queryClient.invalidateQueries({ queryKey: ['<domain>-list'] })
      toast.success('<EntityName> created')
      setOpen(false)
      form.reset()
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New <EntityName></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create <EntityName></DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

## Key Points

- `toast.success` / `toast.error` from `sonner` for feedback
- Always `invalidateQueries` after a successful mutation
- `form.reset()` + `setOpen(false)` after success
- Use `disabled={form.formState.isSubmitting}` to prevent double-submit
