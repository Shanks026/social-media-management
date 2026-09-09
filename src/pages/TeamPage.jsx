import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  UserCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Search,
  Pencil,
  Briefcase,
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

import { SYSTEM_ROLE_PALETTE } from '@/lib/team-roles'
import { usePermissions } from '@/api/usePermissions'
import { useJobRoles, useMemberJobRoles } from '@/api/jobRoles'
import ManageJobRolesDialog from '@/components/team/ManageJobRolesDialog'
import JobRoleBadges from '@/components/team/JobRoleBadges'
import { getJobRoleColor } from '@/lib/job-roles'

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
  const { canManageTeam, isAdmin, isOwner } = usePermissions()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState('active')
  const [sorting, setSorting] = useState([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [removingMember, setRemovingMember] = useState(null)
  const [deletingMember, setDeletingMember] = useState(null)
  const [editingMember, setEditingMember] = useState(null)
  const [jobRolesOpen, setJobRolesOpen] = useState(false)

  const { data: members = [], isLoading: membersLoading } = useTeamMembers()
  const { data: pendingInvites = [] } = usePendingInvites()
  const { data: removedMembers = [] } = useRemovedMembers()
  const { data: jobRoles = [] } = useJobRoles()
  const { data: memberJobRoles = {} } = useMemberJobRoles()
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
    const name = deletingMember.full_name || 'Member'
    try {
      const { authDeleted } = await deleteMemberPermanently.mutateAsync(deletingMember.id)
      toast.success(
        authDeleted
          ? `${name} permanently deleted`
          : `${name}'s access here was removed, but their login is still active on another workspace`,
      )
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

  // jobRoleId → how many members hold it. Derived from the map already loaded
  // for the roster, so the delete confirmation can state its blast radius
  // without another query.
  const jobRoleMemberCounts = useMemo(() => {
    const counts = {}
    for (const roles of Object.values(memberJobRoles)) {
      for (const role of roles) counts[role.id] = (counts[role.id] ?? 0) + 1
    }
    return counts
  }, [memberJobRoles])

  const handleCopyInviteLink = useCallback((token) => {
    const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin
    navigator.clipboard.writeText(`${baseUrl}/join/${token}`)
    toast.success('Link copied')
  }, [])

  // ── Filter chips + table data ─────────────────────────────────────────────

  // Chips are keyed by job role id, not by title string. A member holds several
  // titles now, so "does this member hold role X" replaces the old equality
  // check against a single column — and only roles someone actually holds are
  // offered, so no chip ever returns an empty table.
  const roleOptions = useMemo(() => {
    const hasOwnerOrAdmin = members.some((m) => m.system_role === 'owner' || m.system_role === 'admin')
    const held = new Map()
    for (const m of members) {
      for (const role of memberJobRoles[m.member_user_id] ?? []) held.set(role.id, role)
    }
    const opts = [{ key: 'all', label: 'All Members', dot: null }]
    if (hasOwnerOrAdmin) opts.push({ key: 'elevated', label: 'Owner / Admin', dot: SYSTEM_ROLE_PALETTE.owner.dot })
    ;[...held.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((r) => opts.push({ key: r.id, label: r.name, dot: getJobRoleColor(r.color).dot }))
    return opts
  }, [members, memberJobRoles])

  const tableData = useMemo(() => {
    if (activeTab === 'removed') return removedMembers.map((m) => ({ ...m, _removed: true }))
    if (roleFilter === 'all') return members
    if (roleFilter === 'elevated') return members.filter((m) => m.system_role === 'owner' || m.system_role === 'admin')
    return members.filter((m) =>
      (memberJobRoles[m.member_user_id] ?? []).some((r) => r.id === roleFilter),
    )
  }, [members, removedMembers, roleFilter, activeTab, memberJobRoles])

  // ── Column definitions ────────────────────────────────────────────────────

  const columns = useMemo(() => [
    // No width — absorbs whatever the sized columns leave, so the name/email
    // truncate to the column instead of a hard-coded max-width.
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
              {/* Mobile sits with the email rather than in its own column —
                  the table already carries six and was crowding out the name.
                  get_team_members nulls it for anyone but owner/admin (or the
                  person themselves), so this simply renders nothing for a
                  member. The email truncates and the number does not: a
                  half-shown phone number is useless. */}
              <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <span className="truncate">{m.email}</span>
                {m.mobile_number && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <a
                      href={`tel:${m.mobile_number.replace(/[^\d+]/g, '')}`}
                      className="shrink-0 tabular-nums hover:text-foreground hover:underline"
                    >
                      {m.mobile_number}
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      },
    }),

    columnHelper.accessor('system_role', {
      id: 'system_role',
      meta: { width: '14%' },
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

    columnHelper.display({
      id: 'job_title',
      meta: { width: '18%' },
      header: () => <span className="text-xs font-medium text-muted-foreground">Job Titles</span>,
      cell: ({ row }) => {
        const roles = memberJobRoles[row.original.member_user_id] ?? []
        if (roles.length === 0) return <span className="text-xs text-muted-foreground">—</span>
        // Capped at one pill + a "+N" chip for the rest — this column is
        // 18% of a table row, too narrow for two full titles side by side.
        return <JobRoleBadges roles={roles} max={1} size="xs" />
      },
    }),

    ...(canManageTeam ? [columnHelper.accessor('roles_and_responsibilities', {
      id: 'roles_responsibilities',
      meta: { width: '22%' },
      header: () => <span className="text-xs font-medium text-muted-foreground">Roles &amp; Responsibilities</span>,
      cell: ({ getValue }) => {
        const val = getValue()
        if (!val) return <span className="text-xs text-muted-foreground">—</span>
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground truncate block cursor-default">
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
      meta: { width: '13%' },
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
      meta: { width: '6%' },
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

        // The owner editing their own row: job titles and responsibilities
        // only. Their access is immutable by design (update_member_access
        // refuses the owner row), so no Remove action accompanies it.
        if (canManageTeam && isOwner && isSelf) {
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
                <TooltipContent>Edit your job titles and responsibilities</TooltipContent>
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
  ], [user?.id, canManageTeam, handleRestore, memberJobRoles])

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

            {isAdmin && (
              <div className="flex items-center gap-2 shrink-0">
                {/* Job titles for the workspace. Admins get a read-only view —
                    every write is owner-gated in RLS — so this sits outside the
                    canManageTeam block that wraps invite + active links. */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setJobRolesOpen(true)}
                >
                  <Briefcase size={14} />
                  {canManageTeam ? 'Manage job roles' : 'Job roles'}
                </Button>

                {canManageTeam && (
                  <>
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
                      {/* Copy corrected: links are multi-use now, so "haven't
                          been accepted yet" was describing the old behaviour —
                          a link stays here after someone joins on it. */}
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Anyone with one of these links can join until it expires.
                      </p>
                    </div>
                    {pendingInvites.length === 0 ? (
                      <div className="flex flex-col items-center gap-1.5 py-8 text-center px-4">
                        <span className="text-3xl leading-none select-none">📬</span>
                        <p className="text-sm font-medium mt-1">No active links</p>
                        <p className="text-xs text-muted-foreground">
                          Links you generate appear here until they expire.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/40 max-h-72 overflow-y-auto">
                        {pendingInvites.map((invite) => (
                          <div key={invite.id} className="flex items-start gap-3 px-4 py-3">
                            <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Link size={13} className="text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {invite.label || 'Untitled link'}
                                </p>
                                {/* The role the link grants is the single most
                                    important thing about it — a reusable admin
                                    link makes an admin of everyone who opens
                                    it — so it leads rather than being implied. */}
                                <Badge
                                  className={cn(
                                    'shrink-0 text-[10px] px-1.5 py-0 h-4 font-medium',
                                    (SYSTEM_ROLE_PALETTE[invite.system_role] ?? SYSTEM_ROLE_PALETTE.member).badge,
                                  )}
                                >
                                  {(SYSTEM_ROLE_PALETTE[invite.system_role] ?? SYSTEM_ROLE_PALETTE.member).label}
                                </Badge>
                              </div>

                              <p className="text-xs font-mono text-muted-foreground/70 truncate">
                                /join/{invite.token.slice(0, 18)}…
                              </p>

                              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock size={11} />
                                  Expires {formatDate(invite.expires_at)}
                                </span>
                                {/* Links are multi-use — this is how many have
                                    joined on it, not a limit. */}
                                {invite.use_count > 0 && (
                                  <span className="flex items-center gap-1">
                                    <UserCheck size={11} />
                                    {invite.use_count} joined
                                  </span>
                                )}
                                {/* Was a bare Ban glyph with only a title
                                    attribute, which read as "disabled" rather
                                    than "no document access". Labelled now, with
                                    a real tooltip. */}
                                {invite.permissions?.documents && (() => {
                                  const docsCfg = DOCS_LEVEL_CONFIG[invite.permissions.documents]
                                  const DocsIcon = docsCfg?.icon
                                  if (!docsCfg) return null
                                  return (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="flex items-center gap-1">
                                          {DocsIcon && <DocsIcon size={11} />}
                                          Docs: {docsCfg.label}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>{docsCfg.description}</TooltipContent>
                                    </Tooltip>
                                  )
                                })()}
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => handleCopyInviteLink(invite.token)}
                                  >
                                    <Copy className="size-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copy link</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleRevoke(invite.id)}
                                  >
                                    <Trash2 className="size-3" />
                                  </Button>
                                </TooltipTrigger>
                                {/* Revoking kills the link for everyone, not
                                    just future joiners — worth saying, since
                                    one link may now be out with several people. */}
                                <TooltipContent>
                                  Revoke — stops anyone else joining on this link
                                </TooltipContent>
                              </Tooltip>
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
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Tabs ── */}
          {canManageTeam && (
            <Tabs
              value={activeTab}
              onValueChange={(v) => { setActiveTab(v); setRoleFilter('all') }}
              className="w-full"
            >
              <TabsList className="bg-transparent h-auto w-full justify-start rounded-none p-0 gap-8 border-b border-border/40">
                {[
                  { key: 'active', label: 'Active Members', count: members.length },
                  { key: 'removed', label: 'Removed', count: removedMembers.length },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.key}
                    value={tab.key}
                    className="
                      relative rounded-none bg-transparent px-0 pb-3 pt-0 text-[13px] font-medium transition-none
                      shadow-none border-b-2 border-transparent text-muted-foreground
                      flex-none w-fit gap-2
                      data-[state=active]:bg-transparent
                      dark:data-[state=active]:bg-transparent
                      data-[state=active]:text-black
                      dark:data-[state=active]:text-white
                      data-[state=active]:border-black
                      dark:data-[state=active]:border-white
                      data-[state=active]:shadow-none
                      data-[state=active]:border-x-0
                      data-[state=active]:border-t-0
                      focus-visible:ring-0
                    "
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 min-w-5 text-center">
                        {tab.count}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

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
              {activeTab === 'active' && roleOptions.length > 1 && (
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
                <div className="text-4xl leading-none select-none mb-2">
                  {activeTab === 'removed' ? '🗂️' : '👥'}
                </div>
                <EmptyHeader>
                  <EmptyTitle className="font-bold text-xl">
                    {activeTab === 'removed'
                      ? 'No removed members'
                      : members.length === 0
                        ? 'Just you for now'
                        : 'No members match this filter'}
                  </EmptyTitle>
                  <EmptyDescription className="font-normal">
                    {activeTab === 'removed'
                      ? 'Members you remove from the workspace show up here.'
                      : members.length === 0
                        ? 'Invite a teammate to collaborate on client accounts and share the workload.'
                        : 'Try selecting a different role filter above.'}
                  </EmptyDescription>
                </EmptyHeader>
                {canManageTeam && activeTab === 'active' && members.length === 0 && (
                  <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
                    <UserPlus className="size-4 mr-2" />
                    Invite Team Member
                  </Button>
                )}
              </EmptyContent>
            </Empty>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <Table className="table-fixed">
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id} className="hover:bg-transparent border-b border-border/50 bg-muted/20">
                      {hg.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          className="px-4 h-10"
                          style={{ width: header.column.columnDef.meta?.width }}
                        >
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

          <ManageJobRolesDialog
            open={jobRolesOpen}
            onOpenChange={setJobRolesOpen}
            roles={jobRoles}
            memberCounts={jobRoleMemberCounts}
            canManage={isOwner}
          />

          {editingMember && (
            <EditAccessDialog
              member={editingMember}
              open={!!editingMember}
              onOpenChange={(v) => { if (!v) setEditingMember(null) }}
              onSave={handleSaveAccess}
              // The owner-row path writes via set_member_responsibilities
              // instead of onSave, so it needs its own refresh + toast.
              onSaved={() => {
                queryClient.invalidateQueries({ queryKey: teamKeys.members(workspaceUserId) })
                toast.success('Details updated')
              }}
              onManageJobRoles={() => setJobRolesOpen(true)}
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
                <AlertDialogDescription asChild>
                  <div className="space-y-2">
                    <p>
                      This deletes {deletingMember?.full_name || 'this member'}&apos;s login entirely —
                      they would need a brand new account to ever rejoin. Deliverables, tasks, and chat
                      messages they created stay exactly as they are, but will now show{' '}
                      <span className="font-medium text-foreground">you</span> as the author instead of them.
                    </p>
                    <p>
                      If they belong to another Tercero workspace, their login is left intact and only
                      their access and data here are removed.
                    </p>
                    <p className="font-medium text-foreground">This cannot be undone.</p>
                  </div>
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
