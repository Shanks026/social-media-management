import { Plus, MoreHorizontal } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchClients, deleteClient } from '@/api/clients'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import { Skeleton } from '../ui/skeleton'

export function NavClients({ onCreateOpen, onEditClient }) {
  const { state } = useSidebar()
  const queryClient = useQueryClient()
  const location = useLocation()

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: fetchClients,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteClient,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  })

  return (
    <SidebarGroup className="flex-1 min-h-0 flex flex-col overflow-x-hidden">
      {state === 'expanded' && (
        <SidebarGroupLabel className="flex items-center justify-between px-2 flex-shrink-0">
          Clients
          <button
            onClick={onCreateOpen}
            className="p-1 hover:bg-accent rounded-md transition-colors"
          >
            <Plus className="size-4" />
          </button>
        </SidebarGroupLabel>
      )}

      <SidebarGroupContent className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <SidebarMenu>
          {clients.map((client) => {
            const clientUrl = `/clients/${client.id}`
            const isCurrentlyActive = location.pathname === clientUrl

            return (
              <SidebarMenuItem key={client.id}>
                <SidebarMenuButton
                  asChild
                  tooltip={client.name}
                  isActive={isCurrentlyActive} // Trigger shadcn's built-in active styles
                  className={`group/item flex items-center h-9 ${
                    state === 'collapsed' ? 'justify-center p-0' : 'px-2 gap-3'
                  }`}
                >
                  <NavLink
                    to={clientUrl}
                    className="flex items-center min-w-0 w-full"
                  >
                    <Avatar className="size-5 shrink-0 rounded-sm">
                      <AvatarImage
                        src={client.logo_url}
                        className="object-cover"
                      />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {client.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {state === 'expanded' && (
                      <>
                        <span className="truncate">{client.name}</span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                              }}
                              className="opacity-0 group-hover/item:opacity-100 p-1 ml-auto shrink-0 hover:bg-black/10 dark:hover:bg-white/10 rounded-md transition-opacity"
                            >
                              <MoreHorizontal className="size-4 text-muted-foreground" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent side="right" className="w-32 p-1">
                            <button
                              className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded"
                              onClick={() => onEditClient(client)}
                            >
                              Edit
                            </button>
                            <button
                              className="w-full text-left px-2 py-1.5 text-sm text-destructive hover:bg-accent rounded"
                              onClick={() => deleteMutation.mutate(client.id)}
                            >
                              Delete
                            </button>
                          </PopoverContent>
                        </Popover>
                      </>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
