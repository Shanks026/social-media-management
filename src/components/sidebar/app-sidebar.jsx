import {
  Home,
  Settings,
  LogOut,
  ChevronsUpDown,
  User,
  Mail,
  UserStar,
} from "lucide-react";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSidebar } from "@/components/ui/sidebar";

import {
  Sidebar,
  SidebarHeader,
  SidebarFooter,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from "@/components/ui/sidebar";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { Separator } from "../ui/separator";
import { Plus, MoreHorizontal } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchClients, deleteClient } from "@/api/clients";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

import CreateClient from "../../pages/CreateClient";
import EditClient from "../../pages/EditClient";
import { NavLink } from "react-router-dom";
import { Skeleton } from "../ui/skeleton";

const navItems = [
  { title: "Home", url: "#", icon: Home },
  { title: "Clients", url: "/clients", icon: UserStar },
  { title: "Settings", url: "#", icon: Settings },
];

export function AppSidebar({ user }) {
  const { state } = useSidebar();

  const [createOpen, setCreateOpen] = useState(false);
  const [editClient, setEditClient] = useState(null);

  const queryClient = useQueryClient();

  const { data: clients = [], isLoading: isClientsLoading, } = useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  async function handleLogout() {
    await supabase.auth.signOut();
    // App.jsx listener handles redirect
  }

  const fullName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User";

  const email = user?.email || "";

  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <Sidebar className="border-r flex flex-col" collapsible="icon" variant='custom'>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg">
                <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold shrink-0">
                  Sa
                </div>

                <div className="flex flex-col text-left min-w-0">
                  <span className="text-sm font-bold truncate">Saturn</span>
                  <span className="text-xs text-muted-foreground truncate">
                    Development
                  </span>
                </div>

                <ExpandedOnly>
                  <SidebarTrigger />
                </ExpandedOnly>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <CollapsedOnly>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Expand sidebar"
                  className="justify-center"
                >
                  <div className="mt-2">
                    <SidebarTrigger />
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </CollapsedOnly>
          </SidebarMenu>
        </SidebarHeader>

        <Separator />

        {/* Main content area - Navigation */}
        <SidebarContent className="flex-none">
          <SidebarGroup>
            {state === "expanded" && (
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            )}

            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Home">
                    <a href="/">
                      <Home className="size-4 shrink-0" />
                      <span>Home</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Clients">
                    <NavLink to="/clients">
                      <UserStar className="size-4 shrink-0" />
                      <span>Clients</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Clients section - Takes remaining height */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <SidebarGroup className="flex-1 min-h-0 flex flex-col">
            {state === "expanded" && (
              <SidebarGroupLabel className="flex items-center justify-between px-2 py-1.5 flex-shrink-0">
                Clients
                <button
                  onClick={() => setCreateOpen(true)}
                  className="rounded-md p-1 hover:bg-accent transition-colors"
                >
                  <Plus className="size-4" />
                </button>
              </SidebarGroupLabel>
            )}

            <SidebarGroupContent className="flex-1 min-h-0 overflow-hidden">
              <SidebarMenu className="h-full">
                <div
                  className="h-full overflow-y-auto clients-scroll-container overflow-x-hidden"
                  style={{
                    maxHeight: "calc(100vh - 300px)", // Adjust based on your layout
                  }}
                >
                  {isClientsLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <SidebarClientSkeleton key={i} />
                    ))
                  ) : (
                    clients.map((client) => (
                      <SidebarMenuItem key={client.id} className="px-2">
                        <div className="relative group/item hover:bg-accent rounded-md">
                          <div className="flex items-center min-w-0">
                            <NavLink
                              to={`/clients/${client.id}`}
                              className="flex-1 flex items-center gap-2 min-w-0 py-2 px-2"
                            >
                              <span className="truncate text-sm">
                                {client.name}
                              </span>
                            </NavLink>

                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  className="
                  ml-auto
                  opacity-0
                  group-hover/item:opacity-100
                  transition-opacity
                  p-1
                  rounded-md
                  hover:bg-accent
                  flex-shrink-0
                  mr-1
                "
                                >
                                  <MoreHorizontal className="size-4 text-muted-foreground" />
                                </button>
                              </PopoverTrigger>

                              <PopoverContent side="right" className="w-32 p-1">
                                <button
                                  className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                                  onClick={() => setEditClient(client)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="w-full rounded px-2 py-1.5 text-left text-sm text-destructive hover:bg-accent"
                                  onClick={() => deleteMutation.mutate(client.id)}
                                >
                                  Delete
                                </button>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      </SidebarMenuItem>
                    ))
                  )}

                </div>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>

        {/* Fixed bottom sections */}
        <div className="flex-shrink-0">
          <SidebarContent className="flex-shrink-0">
            <SidebarGroup className="flex-shrink-0">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Settings">
                      <NavLink to="/settings">
                        <Settings className="size-4" />
                        <span>Settings</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <Separator />

          <SidebarFooter className="flex-shrink-0">
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
                        <span className="text-sm font-medium truncate">
                          {fullName}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {email}
                        </span>
                      </div>

                      <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent side="top" align="start" className="w-56">
                    <div className="flex items-center gap-3 px-3 py-2">
                      <Avatar className="size-9">
                        <AvatarImage src={user?.user_metadata?.avatar_url} />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>

                      <div className="flex flex-col leading-tight">
                        <span className="text-sm font-medium">{fullName}</span>
                        <span className="text-xs text-muted-foreground">
                          {email}
                        </span>
                      </div>
                    </div>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem>
                      <User className="mr-2 size-4" />
                      Profile
                    </DropdownMenuItem>

                    <DropdownMenuItem>
                      <Mail className="mr-2 size-4" />
                      Inbox
                    </DropdownMenuItem>

                    <DropdownMenuItem>
                      <Settings className="mr-2 size-4" />
                      Account
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="text-destructive focus:text-destructive"
                    >
                      <LogOut className="mr-2 size-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </div>
      </Sidebar>

      <CreateClient open={createOpen} onOpenChange={setCreateOpen} />

      {editClient && (
        <EditClient
          client={editClient}
          onClose={() => setEditClient(null)}
        />
      )}
    </>
  );
}

function ExpandedOnly({ children }) {
  const { state } = useSidebar();
  return state === "expanded" ? (
    <div className="ml-auto shrink-0">{children}</div>
  ) : null;
}

function CollapsedOnly({ children }) {
  const { state } = useSidebar();
  return state === "collapsed" ? children : null;
}

function SidebarClientSkeleton() {
  return (
    <div className="px-2 py-1">
      <div className="flex items-center gap-2 rounded-md px-2 py-2">
        <Skeleton className="h-4 w-full max-w-[140px]" />
        {/* <Skeleton className="h-4 w-4 ml-auto rounded-sm" /> */}
      </div>
    </div>
  );
}
