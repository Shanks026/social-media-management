import { initials } from '@/lib/format'
import { useState } from 'react'
import { LogOut, ChevronsUpDown, UserPlus, X } from 'lucide-react'
import { useClearSessionCache } from '@/api/auth'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { SYSTEM_ROLE_PALETTE } from '@/lib/team-roles'
import { getLinkedAccounts, removeLinkedAccount, switchToAccount, MAX_LINKED_ACCOUNTS } from '@/lib/accountSwitcher'
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import AddAccountDialog from './AddAccountDialog'

export function NavUser({ user }) {
  const navigate = useNavigate()
  const clearSessionCache = useClearSessionCache()
  const { signOut, userRole } = useAuth()
  const [addAccountOpen, setAddAccountOpen] = useState(false)
  const [accounts, setAccounts] = useState(() => getLinkedAccounts())
  const roleLabel = SYSTEM_ROLE_PALETTE[userRole]?.label ?? userRole ?? 'Member'

  const otherAccounts = accounts.filter((a) => a.user_id !== user?.id)
  const atLimit = accounts.length >= MAX_LINKED_ACCOUNTS

  const handleLogout = async () => {
    // Use the coordinated signOut: it clears auth state synchronously (session
    // → null redirects to /login and unmounts the shell in the same render) and
    // cancels the deferred SIGNED_OUT clear. Only then wipe the query cache —
    // clearing it while the shell is still mounted blanks the subscription and
    // flashes the screen.
    await signOut()
    if (user?.id) removeLinkedAccount(user.id)
    clearSessionCache()
  }

  const handleSwitch = async (account) => {
    const { success, error } = await switchToAccount(account.user_id)
    if (success) {
      clearSessionCache()
      navigate('/dashboard')
    } else {
      toast.error(
        error ? `Couldn't switch to ${account.email} — try logging in again.` : 'Failed to switch account.'
      )
      setAccounts(getLinkedAccounts())
    }
  }

  const handleRemove = (e, userId) => {
    e.stopPropagation()
    removeLinkedAccount(userId)
    setAccounts((prev) => prev.filter((a) => a.user_id !== userId))
  }

  const fullName =
    user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const userInitials = initials(user?.user_metadata?.full_name, { email: user?.email })

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu onOpenChange={(open) => { if (open) setAccounts(getLinkedAccounts()) }}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip="Account">
              <Avatar className="size-8">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-left min-w-0">
                <span className="text-sm font-medium truncate">{fullName}</span>
                <span className="text-xs text-muted-foreground truncate">
                  {roleLabel}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-64">
            <div className="flex items-center gap-3 px-3 py-2.5">
              <Avatar className="size-9 shrink-0">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">{fullName}</span>
                <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
              </div>
            </div>
            <DropdownMenuSeparator />

            {otherAccounts.length > 0 && (
              <>
                <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal">
                  Switch account
                </DropdownMenuLabel>
                {otherAccounts.map((account) => (
                  <DropdownMenuItem
                    key={account.user_id}
                    onClick={() => handleSwitch(account)}
                    className="group gap-2.5"
                  >
                    <Avatar className="size-6 shrink-0">
                      <AvatarImage src={account.avatar_url} />
                      <AvatarFallback className="text-[10px]">
                        {initials(account.full_name, { email: account.email })}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm truncate">{account.full_name || account.email}</span>
                      <span className="text-xs text-muted-foreground truncate">{account.email}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleRemove(e, account.user_id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground shrink-0 transition-opacity"
                      aria-label={`Remove ${account.email}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuItem
              onClick={() => {
                if (atLimit) {
                  toast.error(`You can link up to ${MAX_LINKED_ACCOUNTS} accounts. Remove one to add another.`)
                  return
                }
                setAddAccountOpen(true)
              }}
              className={atLimit ? 'text-muted-foreground' : undefined}
            >
              <UserPlus className="mr-2 size-4" /> Add another account
              {atLimit && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {accounts.length}/{MAX_LINKED_ACCOUNTS}
                </span>
              )}
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 size-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <AddAccountDialog open={addAccountOpen} onOpenChange={setAddAccountOpen} />
    </SidebarMenu>
  )
}
