import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { useUpdateProspect, PROSPECT_STATUSES, PROSPECT_SOURCES } from '@/api/prospects'
import { INDUSTRY_OPTIONS } from '@/lib/industries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  business_name:     z.string().min(1, 'Business name is required'),
  contact_name:      z.string().optional(),
  email:             z.string().email('Invalid email').optional().or(z.literal('')),
  phone:             z.string().optional(),
  website:           z.string().optional(),
  location:          z.string().optional(),
  address:           z.string().optional(),
  instagram:         z.string().optional(),
  linkedin:          z.string().optional(),
  industry:          z.string().optional(),
  source:            z.string().optional(),
  status:            z.string().optional(),
  last_contacted_at: z.string().optional(),
  next_followup_at:  z.string().optional(),
  notes:             z.string().optional(),
})

function toDateInputValue(isoString) {
  if (!isoString) return ''
  return isoString.slice(0, 10)
}

function toIso(dateString) {
  if (!dateString) return null
  return new Date(dateString).toISOString()
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EditProspectDialog({ prospect, open, onOpenChange }) {
  const updateProspect = useUpdateProspect()

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      business_name:     '',
      contact_name:      '',
      email:             '',
      phone:             '',
      website:           '',
      location:          '',
      address:           '',
      instagram:         '',
      linkedin:          '',
      industry:          '',
      source:            'manual',
      status:            'new',
      last_contacted_at: '',
      next_followup_at:  '',
      notes:             '',
    },
  })

  useEffect(() => {
    if (prospect && open) {
      form.reset({
        business_name:     prospect.business_name ?? '',
        contact_name:      prospect.contact_name ?? '',
        email:             prospect.email ?? '',
        phone:             prospect.phone ?? '',
        website:           prospect.website ?? '',
        location:          prospect.location ?? '',
        address:           prospect.address ?? '',
        instagram:         prospect.instagram ?? '',
        linkedin:          prospect.linkedin ?? '',
        industry:          prospect.industry ?? '',
        source:            prospect.source ?? 'manual',
        status:            prospect.status ?? 'new',
        last_contacted_at: toDateInputValue(prospect.last_contacted_at),
        next_followup_at:  toDateInputValue(prospect.next_followup_at),
        notes:             prospect.notes ?? '',
      })
    }
  }, [prospect, open, form])

  async function onSubmit(values) {
    try {
      const cleaned = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, v === '' ? null : v])
      )
      cleaned.business_name     = values.business_name
      cleaned.source            = values.source || 'manual'
      cleaned.status            = values.status || 'new'
      cleaned.last_contacted_at = toIso(values.last_contacted_at)
      cleaned.next_followup_at  = toIso(values.next_followup_at)

      await updateProspect.mutateAsync({
        id:          prospect.id,
        _prevStatus: prospect.status,
        ...cleaned,
      })
      toast.success('Prospect updated')
      onOpenChange(false)
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:max-w-3xl p-0 gap-0">

        {/* Inner flex column — owns the height constraint and scroll */}
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '88vh' }}>

          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
            <DialogTitle>Edit Prospect</DialogTitle>
          </DialogHeader>

          {/* Scrollable body */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="overflow-y-auto px-6 py-5 space-y-5" style={{ flex: 1 }}>

                {/* ── Contact Info ────────────────────────────────────── */}
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Contact Info</p>

                <FormField control={form.control} name="business_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Name <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="contact_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl><Input placeholder="Jane Doe" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input placeholder="jane@acme.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone / WhatsApp</FormLabel>
                      <FormControl><Input placeholder="+91 98765 43210" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="website" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl><Input placeholder="https://acme.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="location" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl><Input placeholder="Mumbai, India" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl><Input placeholder="Full street address" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="instagram" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instagram</FormLabel>
                      <FormControl><Input placeholder="@handle or URL" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="linkedin" render={({ field }) => (
                    <FormItem>
                      <FormLabel>LinkedIn</FormLabel>
                      <FormControl><Input placeholder="linkedin.com/in/..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* ── Pipeline ────────────────────────────────────────── */}
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider pt-2">Pipeline</p>

                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROSPECT_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="industry" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {INDUSTRY_OPTIONS.filter((o) => o.value !== 'Internal').map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="source" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PROSPECT_SOURCES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="last_contacted_at" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Contacted</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="next_followup_at" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Next Follow-up</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Running notes about this prospect..."
                        className="resize-none"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

              </div>

              {/* Fixed footer */}
              <DialogFooter className="px-6 py-4 border-t border-border/40 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="text-muted-foreground"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateProspect.isPending}>
                  {updateProspect.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>

        </div>
      </DialogContent>
    </Dialog>
  )
}
