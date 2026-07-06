import { useMemo } from 'react'
import { toast } from 'sonner'
import { createIsolatedAuthClient } from '@/lib/accountSwitcherClient'
import { upsertLinkedAccount, switchToAccount } from '@/lib/accountSwitcher'
import { LoginForm } from '@/components/auth/login-form'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export default function AddAccountDialog({ open, onOpenChange }) {
  // Fresh throwaway client per dialog open — authenticates the second account
  // without ever touching the primary client's active session.
  const isolatedClient = useMemo(
    () => (open ? createIsolatedAuthClient() : null),
    [open],
  )

  async function handleAdded(session) {
    upsertLinkedAccount({
      user_id: session.user.id,
      email: session.user.email,
      full_name: session.user.user_metadata?.full_name ?? null,
      avatar_url: session.user.user_metadata?.avatar_url ?? null,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      updated_at: Date.now(),
    })

    const { success, error } = await switchToAccount(session.user.id)
    onOpenChange(false)

    if (success) toast.success(`Switched to ${session.user.email}`)
    else toast.error(error?.message || 'Account added, but switching to it failed.')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add another account</DialogTitle>
          <DialogDescription>
            Log in with a different Tercero account. You can switch back anytime from the account menu.
          </DialogDescription>
        </DialogHeader>
        {isolatedClient && (
          <LoginForm client={isolatedClient} onSuccess={handleAdded} className="pt-2" />
        )}
      </DialogContent>
    </Dialog>
  )
}
