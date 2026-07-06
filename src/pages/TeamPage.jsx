import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { useHeader } from '@/components/misc/header-context'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  UserPlus,
  Copy,
  Trash2,
  Link,
  CalendarDays,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Search,
  Pencil,
} from 'lucide-react'
import {
  useTeamMembers,
  usePendingInvites,
  useRemovedMembers,
  useRemoveMember,
  useRevokeInvite,
  useRestoreMember,
  useDeleteMemberPermanently,
  updateMemberAccess,
  teamKeys,
} from '@/api/team'
import { useQueryClient } from '@tanstack/react-query'
import { InviteDialog, EditAccessDialog, DOCS_LEVEL_CONFIG } from './settings/TeamSettings'
import { formatDate } from '@/lib/helper'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'

import {
  SYSTEM_ROLE_PALETTE,
  REMOVED_PALETTE,
  getRolePalette,
} from '@/lib/team-roles'
import { usePermissions } from '@/api/usePermissions'

// ─── Sub-components ─────────────────────────────────────────────────────────

function MemberAvatar({ name, email, avatarUrl }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || email}
        className="size-8 rounded-lg object-cover shrink-0"
      />
    )
  }
  const initials = name
    ? name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : (email?.[0] ?? '?').toUpperCase()
  return (
    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
      {initials}
    </div>
  )
}

function SortableHeader({ column, label }) {
  const dir = column.getIsSorted()
  return (
    <button
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => column.toggleSorting(dir === 'asc')}
    >
      {label}
      {dir === 'asc' ? (
        <ArrowUp className="size-3" />
      ) : dir === 'desc' ? (
        <ArrowDown className="size-3" />
      ) : (
        <ArrowUpDown className="size-3 opacity-40" />
      )}
    </button>
  )
}

const columnHelper = createColumnHelper()

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { setHeader } = useHeader()
  const { user, workspaceUserId } = useAuth()
  const { canManageTeam } = usePermissions()
  const queryClient = useQueryClient()

  const [sorting, setSorting] = useState([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [removingMember, setRemovingMember] = useState(null)
  const [deletingMember, setDeletingMember] = useState(null)
  const [editingMember, setEditingMember] = useState(null)

  const { data: members = [], isLoading: membersLoading } = useTeamMembers()
  const { data: pendingInvites = [] } = usePendingInvites()
  const { data: removedMembers = [] } = useRemovedMembers()
  const removeMember = useRemoveMember()
  const revokeInvite = useRevokeInvite()
  const restoreMember = useRestoreMember()
  const deleteMemberPermanently = useDeleteMemberPermanently()

  useEffect(() => {
    setHeader({
      title: 'Team',
      breadcrumbs: [{ label: 'My Organization' }, { label: 'Team' }],
    })
  }, [setHeader])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRemove = useCallback(async () => {
    if (!removingMember) return
    try {
      await removeMember.mutateAsync(removingMember.id)
      toast.success(`${removingMember.full_name || 'Team member'} removed`)
    } catch (err) {
      toast.error(err.message || 'Failed to remove member')
    } finally {
      setRemovingMember(null)
    }
  }, [removingMember, removeMember])

  const handleRevoke = useCallback(async (inviteId) => {
    try {
      await revokeInvite.mutateAsync(inviteId)
      toast.success('Invite revoked')
    } catch (err) {
      toast.error(err.message || 'Failed to revoke invite')
    }
  }, [revokeInvite])

  const handleRestore = useCallback(async (member) => {
    try {
      await restoreMember.mutateAsync(member.id)
      toast.success(`${member.full_name || 'Member'} restored`)
    } catch (err) {
      toast.error(err.message || 'Failed to restore member')
    }
  }, [restoreMember])

  const handleDeletePermanently = useCallback(async () => {
    if (!deletingMember) return
    try {
      await deleteMemberPermanently.mutateAsync(deletingMember.id)
      toast.success(`${deletingMember.full_name || 'Member'} permanently deleted`)
    } catch (err) {
      toast.error(err.message || 'Failed to delete member')
    } finally {
      setDeletingMember(null)
    }
  }, [deletingMember, deleteMemberPermanently])

  const handleSaveAccess = useCallback(async (memberId, payload) => {
    await updateMemberAccess(memberId, payload)
    queryClient.invalidateQueries({ queryKey: teamKeys.members(workspaceUserId) })
    toast.success('Member updated')
  }, [queryClient, workspaceUserId])

  const handleCopyInviteLink = useCallback((token) => {
    const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin
    navigator.clipboard.writeText(`${baseUrl}/join/${token}`)
    toast.success('Link copied')
  }, [])

  // ── Filter chips + table data ─────────────────────────────────────────────

  const roleOptions = useMemo(() => {
    const hasOwnerOrAdmin = members.some((m) => m.system_role === 'owner' || m.system_role === 'admin')
    const functionalRoles = [
      ...new Set(
        members
          .filter((m) => m.functional_role && m.system_role === 'member')
          .map((m) => m.functional_role),
      ),
    ]
    const opts = [{ key: 'all', label: 'All Members', dot: null }]
    if (hasOwnerOrAdmin) opts.push({ key: 'elevated', label: 'Owner / Admin', dot: SYSTEM_ROLE_PALETTE.owner.dot })
    functionalRoles.forEach((r) => opts.push({ key: r, label: r, dot: getRolePalette(r)?.dot }))
    if (canManageTeam && removedMembers.length > 0)
      opts.push({ key: 'removed', label: 'Removed', dot: REMOVED_PALETTE.dot })
    return opts
  }, [members, removedMembers, canManageTeam])

  const tableData = useMemo(() => {
    if (roleFilter === 'removed') return removedMembers.map((m) => ({ ...m, _removed: true }))
    if (roleFilter === 'all') return members
    if (roleFilter === 'elevated') return members.filter((m) => m.system_role === 'owner' || m.system_role === 'admin')
    return members.filter((m) => m.functional_role === roleFilter)
  }, [members, removedMembers, roleFilter])

  // ── Column definitions ────────────────────────────────────────────────────

  const columns = useMemo(() => [
    columnHelper.accessor((row) => row.full_name || row.email, {
      id: 'member',
      header: ({ column }) => <SortableHeader column={column} label="Member" />,
      cell: ({ row }) => {
        const m = row.original
        const isSelf = m.member_user_id === user?.id
        return (
          <div className="flex items-center gap-3 py-1">
            <MemberAvatar name={m.full_name} email={m.email} avatarUrl={m.avatar_url} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-medium leading-tight">
                  {m.full_name || m.email}
                </span>
                {isSelf && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                    You
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-55">
                {m.email}
              </p>
            </div>
          </div>
        )
      },
    }),

    columnHelper.accessor('system_role', {
      id: 'system_role',
      header: () => <span className="text-xs font-medium text-muted-foreground">Access</span>,
      cell: ({ row }) => {
        const m = row.original
        const sysPalette = SYSTEM_ROLE_PALETTE[m.system_role] ?? SYSTEM_ROLE_PALETTE.member
        return (
          <Badge className={sysPalette.badge}>
            {sysPalette.label}
          </Badge>
        )
      },
    }),

    columnHelper.accessor('functional_role', {
      id: 'job_title',
      header: () => <span className="text-xs font-medium text-muted-foreground">Job Title</span>,
      cell: ({ row }) => {
        const m = row.original
        const funcPalette = m.functional_role ? getRolePalette(m.functional_role) : null
        if (!funcPalette) return <span className="text-xs text-muted-foreground">—</span>
        return (
          <Badge variant="outline" className="gap-1.5 font-normal">
            <span className={cn('size-1.5 rounded-full shrink-0', funcPalette.dot)} />
            {m.functional_role}
          </Badge>
        )
      },
    }),

    ...(canManageTeam ? [columnHelper.accessor('roles_and_responsibilities', {
      id: 'roles_responsibilities',
      header: () => <span className="text-xs font-medium text-muted-foreground">Roles &amp; Responsibilities</span>,
      cell: ({ getValue }) => {
        const val = getValue()
        if (!val) return <span className="text-xs text-muted-foreground">—</span>
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground truncate max-w-52 block cursor-default">
                {val}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-72 whitespace-pre-wrap">
              {val}
            </TooltipContent>
          </Tooltip>
        )
      },
    })] : []),

    columnHelper.accessor('joined_at', {
      id: 'joined',
      header: ({ column }) => <SortableHeader column={column} label="Joined" />,
      sortingFn: 'datetime',
      cell: ({ row }) => {
        const m = row.original
        if (m._removed) {
          return <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal">Removed</Badge>
        }
        return (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays size={11} className="shrink-0" />
            {formatDate(m.joined_at)}
          </div>
        )
      },
    }),

    columnHelper.display({
      id: 'actions',
      header: () => null,
      cell: ({ row }) => {
        const m = row.original
        const isSelf = m.member_user_id === user?.id
        const isOwner = m.system_role === 'owner'

        if (m._removed) {
          return (
            <div className="flex items-center justify-end gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-foreground"
                    onClick={() => handleRestore(m)}
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Restore access</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeletingMember(m)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete permanently</TooltipContent>
              </Tooltip>
            </div>
          )
        }

        if (canManageTeam && !isOwner && !isSelf) {
          return (
            <div className="flex items-center justify-end gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setEditingMember(m)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit member</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setRemovingMember(m)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove member</TooltipContent>
              </Tooltip>
            </div>
          )
        }

        return null
      },
    }),
  ], [user?.id, canManageTeam, handleRestore])

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="h-full bg-background overflow-y-auto overflow-x-hidden selection:bg-primary/10 [scrollbar-gutter:stable]">
      <div className="overflow-hidden">
        <div className="px-8 pt-8 pb-20 space-y-6 max-w-350 mx-auto animate-in fade-in duration-700 fill-mode-both">

          {/* ── Page header ── */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-normal tracking-tight text-foreground bricolage">
                Team
              </h1>
              <p className="text-sm text-muted-foreground font-normal">
                Manage workspace members, invites, and access.
              </p>
            </div>

            {canManageTeam && (
              <div className="flex items-center gap-2 shrink-0">
                {/* ── Active Links popover ── */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Link size={14} />
                      Active Links
                      {pendingInvites.length > 0 && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0 min-w-4.5 text-center">
                          {pendingInvites.length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-105 p-0" align="end">
                    <div className="px-4 pt-4 pb-3 border-b border-border/50">
                      <p className="text-base font-semibold">Active Links</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Active invite links that haven&apos;t been accepted yet.
                      </p>
                    </div>
                    {pendingInvites.length === 0 ? (
                      <div className="flex flex-col items-center gap-1.5 py-8 text-center px-4">
                        <span className="text-3xl leading-none select-none">📬</span>
                        <p className="text-sm font-medium mt-1">No active links</p>
                        <p className="text-xs text-muted-foreground">
                          Links you generate will appear here until accepted.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/40 max-h-72 overflow-y-auto">
                        {pendingInvites.map((invite) => (
                          <div key={invite.id} className="flex items-start gap-3 px-4 py-3">
                            <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Link size={13} className="text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {invite.label || `/join/${invite.token.slice(0, 18)}…`}
                                </p>
                                {invite.permissions?.documents && (() => {
                                  const docsCfg = DOCS_LEVEL_CONFIG[invite.permissions.documents]
                                  const DocsIcon = docsCfg?.icon
                                  if (!DocsIcon) return null
                                  return (
                                    <DocsIcon
                                      className="size-3.5 text-muted-foreground shrink-0"
                                      title={`Document access: ${docsCfg.label}`}
                                    />
                                  )
                                })()}
                              </div>
                              {invite.label && (
                                <p className="text-xs font-mono text-muted-foreground/70 truncate">
                                  /join/{invite.token.slice(0, 18)}…
                                </p>
                              )}
                              <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <CalendarDays size={11} />
                                  {formatDate(invite.created_at)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock size={11} />
                                  Expires {formatDate(invite.expires_at)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground hover:text-foreground"
                                onClick={() => handleCopyInviteLink(invite.token)}
                                title="Copy link"
                              >
                                <Copy className="size-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRevoke(invite.id)}
                                title="Revoke"
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>

                <Button size="sm" className="gap-2" onClick={() => setInviteOpen(true)}>
                  <UserPlus size={14} />
                  Invite Team Member
                </Button>
              </div>
            )}
          </div>

          {/* ── Search + filter toolbar ── */}
          {!membersLoading && (
            <div className="flex items-center gap-3">
              <div className="relative w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search members…"
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <div className="flex-1" />
              {roleOptions.length > 1 && (
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger size="sm" className="w-40 h-8">
                    <SelectValue>
                      {(() => {
                        const opt = roleOptions.find((o) => o.key === roleFilter)
                        return (
                          <span className="flex items-center gap-2">
                            {opt?.dot
                              ? <span className={cn('size-2 rounded-full shrink-0', opt.dot)} />
                              : <span className="size-2 rounded-full shrink-0 bg-muted-foreground/30" />
                            }
                            {opt?.label ?? 'All Members'}
                          </span>
                        )
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((opt) => (
                      <SelectItem key={opt.key} value={opt.key}>
                        <span className="flex items-center gap-2">
                          {opt.dot
                            ? <span className={cn('size-2 rounded-full shrink-0', opt.dot)} />
                            : <span className="size-2 rounded-full shrink-0 bg-muted-foreground/30" />
                          }
                          {opt.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* ── Table ── */}
          {membersLoading ? (
            <div className="space-y-1 rounded-xl overflow-hidden border border-border/50">
              <div className="h-10 bg-muted/30 animate-pulse" />
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 bg-muted/20 animate-pulse" />
              ))}
            </div>
          ) : tableData.length === 0 ? (
            <Empty className="py-16 border border-dashed rounded-2xl bg-muted/5">
              <EmptyContent>
                <div className="text-4xl leading-none select-none mb-2">👥</div>
                <EmptyHeader>
                  <EmptyTitle className="font-bold text-xl">
                    {members.length === 0 ? 'Just you for now' : 'No members match this filter'}
                  </EmptyTitle>
                  <EmptyDescription className="font-normal">
                    {members.length === 0
                      ? 'Invite a teammate to collaborate on client accounts and share the workload.'
                      : 'Try selecting a different role filter above.'}
                  </EmptyDescription>
                </EmptyHeader>
                {canManageTeam && members.length === 0 && (
                  <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
                    <UserPlus className="size-4 mr-2" />
                    Invite Team Member
                  </Button>
                )}
              </EmptyContent>
            </Empty>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id} className="hover:bg-transparent border-b border-border/50 bg-muted/20">
                      {hg.headers.map((header) => (
                        <TableHead key={header.id} className="px-4 h-10">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn(
                        'border-b border-border/40 last:border-0',
                        row.original._removed && 'opacity-50',
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="px-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* ── Dialogs ── */}
          <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />

          {editingMember && (
            <EditAccessDialog
              member={editingMember}
              open={!!editingMember}
              onOpenChange={(v) => { if (!v) setEditingMember(null) }}
              onSave={handleSaveAccess}
            />
          )}

          <AlertDialog
            open={!!removingMember}
            onOpenChange={(open) => !open && setRemovingMember(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove team member?</AlertDialogTitle>
                <AlertDialogDescription>
                  {removingMember?.full_name || 'This member'} will lose access to your workspace
                  immediately. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleRemove}
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog
            open={!!deletingMember}
            onOpenChange={(open) => !open && setDeletingMember(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove {deletingMember?.full_name || 'this member'} from the
                  database. They will need to be re-invited to rejoin. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDeletePermanently}
                >
                  Delete permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

        </div>
      </div>
    </div>
  )
}
