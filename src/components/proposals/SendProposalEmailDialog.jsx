import { useState, useEffect } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { sendProposalEmail, useGenerateProposalToken, useMarkProposalSent } from '@/api/proposals'
import { resolveWorkspace } from '@/lib/workspace'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
})

/**
 * Dialog to send a proposal link via email.
 * Pre-fills the recipient email from the proposal context.
 * On success, advances status to 'sent'.
 */
export function SendProposalEmailDialog({
  open,
  onOpenChange,
  proposal,           // full proposal object
  defaultEmail = '',  // pre-filled from prospect_email or client.email
  defaultName = '',   // pre-filled from prospect_name or client.name
}) {
  const generateToken = useGenerateProposalToken()
  const markSent = useMarkProposalSent()
  const [isSending, setIsSending] = useState(false)

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: defaultEmail },
  })

  // Sync email if defaultEmail changes (e.g. proposal data loads after dialog opens)
  useEffect(() => {
    if (open) {
      form.reset({ email: defaultEmail })
    }
  }, [open, defaultEmail])

  async function onSubmit({ email }) {
    setIsSending(true)
    try {
      // 1. Generate (or re-use) the share token → get URL
      const result = await generateToken.mutateAsync(proposal.id)

      // 2. Send the email
      const { workspaceUserId } = await resolveWorkspace()
      await sendProposalEmail({
        recipientEmail: email,
        recipientName: defaultName || null,
        proposalTitle: proposal.title,
        proposalUrl: result.url,
        agencyUserId: workspaceUserId,
      })

      // 3. Advance to 'sent' only if still a draft
      if (proposal.status === 'draft') {
        await markSent.mutateAsync(proposal.id)
      }

      toast.success(`Proposal sent to ${email}`)
      onOpenChange(false)
    } catch (err) {
      toast.error(err.message || 'Failed to send email')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="size-4 text-primary" />
            </div>
            Send Proposal via Email
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-2">

          {/* Proposal chip */}
          {proposal?.title && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/40 border border-border/40">
              <div className="size-8 rounded-md bg-background border border-border/50 flex items-center justify-center shrink-0">
                <Mail className="size-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Sending</p>
                <p className="text-sm font-medium truncate">{proposal.title}</p>
              </div>
            </div>
          )}

          {/* Email field */}
          <div className="space-y-2">
            <Label htmlFor="send-email" className="text-sm font-medium">
              Recipient email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="send-email"
              type="email"
              placeholder="recipient@company.com"
              autoFocus
              className="h-10"
              {...form.register('email')}
            />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            The recipient will receive a link to view this proposal in their browser. No account required.
          </p>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSending}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSending} className="gap-2 flex-1 sm:flex-none">
              {isSending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Mail className="size-4" />
                  Send Proposal
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
