import { useEffect, useState, useMemo } from 'react'
import { useHeader } from '@/components/misc/header-context'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
  Briefcase,
  RotateCcw,
} from 'lucide-react'
import {
  useTeamMembers,
  usePendingInvites,
  useRemovedMembers,
  useRemoveMember,
  useRevokeInvite,
  useRestoreMember,
  useDeleteMemberPermanently,
} from '@/api/team'
import { InviteDialog } from './settings/TeamSettings'
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

// ─── MemberAvatar ───────────────────────────────────────────────────────────────

function MemberAvatar({ name, email, avatarUrl }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || email}
        className="size-10 rounded-xl object-cover shrink-0"
      />
    )
  }
  const initials = name
    ? name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : (email?.[0] ?? '?').toUpperCase()
  return (
    <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold shrink-0">
      {initials}
    </div>
  )
}

// ─── Tab trigger class (mirrors Deliverables) ────────────────────────────────

const TAB_CLASS = `
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
`

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { setHeader } = useHeader()
  const { user, userRole } = useAuth()
  const isAdmin = userRole === 'admin'

  const [activeTab, setActiveTab] = useState('team')
  const [roleFilter, setRoleFilter] = useState('all')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [removingMember, setRemovingMember] = useState(null)
  const [deletingMember, setDeletingMember] = useState(null)

  const { data: members = [], isLoading: membersLoading } = useTeamMembers()
  const { data: pendingInvites = [] } = usePendingInvites()
  const { data: removedMembers = [] } = useRemovedMembers()
  const removeMember = useRemoveMember()
  const revokeInvite = useRevokeInvite()
  const restoreMember = useRestoreMember()
  const deleteMemberPermanently = useDeleteMemberPermanently()

  // Role filter chips — derived from actual member data; "Removed" added when applicable
  const roleOptions = useMemo(() => {
    const hasAdmins = members.some((m) => m.system_role === 'admin')
    const functionalRoles = [
      ...new Set(
        members
          .filter((m) => m.functional_role && m.system_role !== 'admin')
          .map((m) => m.functional_role),
      ),
    ]
    const opts = [{ key: 'all', label: 'All' }]
    if (hasAdmins) opts.push({ key: 'admin', label: 'Admin' })
    functionalRoles.forEach((r) => opts.push({ key: r, label: r }))
    if (isAdmin && removedMembers.length > 0)
      opts.push({ key: 'removed', label: 'Removed' })
    return opts
  }, [members, removedMembers, isAdmin])

  const filteredMembers = useMemo(() => {
    if (roleFilter === 'removed') return removedMembers
    if (roleFilter === 'all') return members
    if (roleFilter === 'admin') return members.filter((m) => m.system_role === 'admin')
    return members.filter((m) => m.functional_role === roleFilter)
  }, [members, removedMembers, roleFilter])

  useEffect(() => {
    setHeader({
      title: 'Team',
      breadcrumbs: [
        { label: 'Settings', href: '/settings' },
        { label: 'Team' },
      ],
    })
  }, [setHeader])

  const handleRemove = async () => {
    if (!removingMember) return
    try {
      await removeMember.mutateAsync(removingMember.id)
      toast.success(`${removingMember.full_name || 'Team member'} removed`)
    } catch (err) {
      toast.error(err.message || 'Failed to remove member')
    } finally {
      setRemovingMember(null)
    }
  }

  const handleRevoke = async (inviteId) => {
    try {
      await revokeInvite.mutateAsync(inviteId)
      toast.success('Invite revoked')
    } catch (err) {
      toast.error(err.message || 'Failed to revoke invite')
    }
  }

  const handleRestore = async (member) => {
    try {
      await restoreMember.mutateAsync(member.id)
      toast.success(`${member.full_name || 'Member'} restored`)
    } catch (err) {
      toast.error(err.message || 'Failed to restore member')
    }
  }

  const handleDeletePermanently = async () => {
    if (!deletingMember) return
    try {
      await deleteMemberPermanently.mutateAsync(deletingMember.id)
      toast.success(`${deletingMember.full_name || 'Member'} permanently deleted`)
    } catch (err) {
      toast.error(err.message || 'Failed to delete member')
    } finally {
      setDeletingMember(null)
    }
  }

  const handleCopyInviteLink = (token) => {
    const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin
    navigator.clipboard.writeText(`${baseUrl}/join/${token}`)
    toast.success('Link copied')
  }

  return (
    <div className="h-full bg-background overflow-y-auto overflow-x-hidden selection:bg-primary/10 [scrollbar-gutter:stable]">
      <div className="overflow-hidden">
        <div className="px-8 pt-8 pb-20 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-700 fill-mode-both">

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
              <Button
                size="sm"
                className="gap-2 shrink-0"
                onClick={() => setInviteOpen(true)}
              >
                <UserPlus size={14} />
                Invite Team Member
              </Button>
            )}
          </div>

          {/* ── Tabs ── */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-transparent h-auto w-full justify-start rounded-none p-0 gap-8 border-b border-border/40">
              <TabsTrigger value="team" className={TAB_CLASS}>
                Team
                {members.length > 0 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 min-w-[20px] text-center">
                    {members.length}
                  </Badge>
                )}
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="invites" className={TAB_CLASS}>
                  Pending Invites
                  {pendingInvites.length > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 min-w-[20px] text-center">
                      {pendingInvites.length}
                    </Badge>
                  )}
                </TabsTrigger>
              )}
            </TabsList>

            {/* ── Team tab ── */}
            <TabsContent value="team" className="space-y-6 focus-visible:outline-none outline-none">

              {/* Role filter chips */}
              {!membersLoading && roleOptions.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {roleOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setRoleFilter(opt.key)}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-medium transition-colors border',
                        roleFilter === opt.key
                          ? 'bg-foreground text-background border-foreground'
                          : 'bg-transparent text-muted-foreground border-border/50 hover:border-foreground/30 hover:text-foreground',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Member list */}
              {membersLoading ? (
                <div className="max-w-4xl space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-[66px] bg-muted/40 animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : filteredMembers.length === 0 ? (
                <Empty className="py-16 border border-dashed rounded-2xl bg-muted/5">
                  <EmptyContent>
                    <div className="text-4xl leading-none select-none mb-2">👥</div>
                    <EmptyHeader>
                      <EmptyTitle className="font-normal text-xl">
                        {members.length === 0 ? 'Just you for now' : 'No members match this filter'}
                      </EmptyTitle>
                      <EmptyDescription className="font-normal">
                        {members.length === 0
                          ? 'Invite a teammate to collaborate on client accounts and share the workload.'
                          : 'Try selecting a different role filter above.'}
                      </EmptyDescription>
                    </EmptyHeader>
                    {isAdmin && members.length === 0 && (
                      <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
                        <UserPlus className="size-4 mr-2" />
                        Invite Team Member
                      </Button>
                    )}
                  </EmptyContent>
                </Empty>
              ) : (
                <div className="max-w-4xl space-y-3">
                  {filteredMembers.map((member) => {
                    const isRemoved = roleFilter === 'removed'
                    const isSelf = member.member_user_id === user?.id
                    const isOwner = member.system_role === 'admin'
                    return (
                      <div
                        key={member.id}
                        className={cn(
                          'flex items-center gap-4 rounded-xl border border-border/50 bg-card/30 px-5 py-4',
                          isRemoved && 'opacity-60',
                        )}
                      >
                        <MemberAvatar
                          name={member.full_name}
                          email={member.email}
                          avatarUrl={member.avatar_url}
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate">
                              {member.full_name || member.email}
                            </p>
                            {!isRemoved && isOwner && (
                              <Badge variant="secondary" className="text-xs">Admin</Badge>
                            )}
                            {!isRemoved && isSelf && (
                              <Badge variant="outline" className="text-xs">You</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        </div>
                        <div className="hidden sm:flex items-center gap-6 shrink-0">
                          {member.functional_role && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Briefcase size={12} className="shrink-0" />
                              {member.functional_role}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDays size={12} className="shrink-0" />
                            {isRemoved ? 'Removed' : `Joined ${formatDate(member.joined_at)}`}
                          </div>
                        </div>
                        {isRemoved ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-muted-foreground hover:text-foreground"
                                  onClick={() => handleRestore(member)}
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
                                  onClick={() => setDeletingMember(member)}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete permanently</TooltipContent>
                            </Tooltip>
                          </div>
                        ) : (
                          isAdmin && !isOwner && !isSelf && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-destructive shrink-0"
                              onClick={() => setRemovingMember(member)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            {/* ── Pending Invites tab ── */}
            {isAdmin && (
              <TabsContent value="invites" className="space-y-4 focus-visible:outline-none outline-none">
                {pendingInvites.length === 0 ? (
                  <Empty className="py-16 border border-dashed rounded-2xl bg-muted/5">
                    <EmptyContent>
                      <div className="text-4xl leading-none select-none mb-2">📬</div>
                      <EmptyHeader>
                        <EmptyTitle className="font-normal text-xl">No pending invites</EmptyTitle>
                        <EmptyDescription className="font-normal">
                          Invite links you generate will appear here until they&apos;re accepted.
                        </EmptyDescription>
                      </EmptyHeader>
                      <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
                        <UserPlus className="size-4 mr-2" />
                        Invite Team Member
                      </Button>
                    </EmptyContent>
                  </Empty>
                ) : (
                  <div className="max-w-4xl space-y-3">
                    {pendingInvites.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center gap-4 rounded-xl border border-border/50 bg-card/30 px-5 py-4"
                      >
                        <div className="size-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                          <Link size={16} className="text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-sm font-mono text-muted-foreground truncate">
                            /join/{invite.token.slice(0, 20)}…
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarDays size={11} />
                              Created {formatDate(invite.created_at)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              Expires {formatDate(invite.expires_at)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleCopyInviteLink(invite.token)}
                            title="Copy link"
                          >
                            <Copy className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRevoke(invite.id)}
                            title="Revoke"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>

          {/* ── Dialogs ── */}
          <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />

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
