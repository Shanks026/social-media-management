import { LogOut, ChevronsUpDown } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { SYSTEM_ROLE_PALETTE } from '@/lib/team-roles'
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
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

export function NavUser({ user }) {
  const queryClient = useQueryClient()
  const { signOut, userRole } = useAuth()
  const roleLabel = SYSTEM_ROLE_PALETTE[userRole]?.label ?? userRole ?? 'Member'
  const handleLogout = async () => {
    // Use the coordinated signOut: it clears auth state synchronously (session
    // → null redirects to /login and unmounts the shell in the same render) and
    // cancels the deferred SIGNED_OUT clear. Only then wipe the query cache —
    // clearing it while the shell is still mounted blanks the subscription and
    // flashes the screen.
    await signOut()
    queryClient.clear()
  }

  const fullName =
    user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip="Account">
              <Avatar className="size-8">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback>{initials}</AvatarFallback>
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
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">{fullName}</span>
                <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 size-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
