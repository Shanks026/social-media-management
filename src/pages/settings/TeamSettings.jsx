import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  useTeamMembers,
  usePendingInvites,
  useGenerateInvite,
  useRevokeInvite,
  useRemoveMember,
  useRemovedMembers,
  useRestoreMember,
  useDeleteMemberPermanently,
} from '@/api/team'
import { formatDate } from '@/lib/helper'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  UserPlus,
  Copy,
  Check,
  Link,
  Trash2,
  Users,
  CalendarDays,
  Briefcase,
  Clock,
  Loader2,
  RotateCcw,
} from 'lucide-react'
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from '@/components/ui/empty'

// ─── Invite Dialog ─────────────────────────────────────────────────────────────

function InviteDialog({ open, onOpenChange }) {
  const [inviteUrl, setInviteUrl] = useState(null)
  const [copied, setCopied] = useState(false)
  const generateInvite = useGenerateInvite()

  useEffect(() => {
    if (!open) {
      setInviteUrl(null)
      setCopied(false)
      return
    }
    generateInvite
      .mutateAsync()
      .then((url) => setInviteUrl(url))
      .catch((err) => {
        const msg =
          err.message === 'TEAM_SEAT_LIMIT_REACHED'
            ? 'Team seat limit reached. Upgrade your plan to invite more members.'
            : err.message || 'Failed to generate invite link'
        toast.error(msg)
        onOpenChange(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleCopy = () => {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Share this link with your teammate. It expires in 7 days.
          </DialogDescription>
        </DialogHeader>

        {generateInvite.isPending ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Generating link…
          </div>
        ) : inviteUrl ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Invite link</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={inviteUrl}
                  className="text-xs font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="size-4 text-green-500" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              This link expires in 7 days. Send it via WhatsApp, email, or any
              other channel.
            </p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

// ─── Avatar initials ───────────────────────────────────────────────────────────

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
    ? name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : (email?.[0] ?? '?').toUpperCase()
  return (
    <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold shrink-0">
      {initials}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function TeamSettings() {
  const { user, userRole } = useAuth()
  const isAdmin = userRole === 'admin'

  const { data: members = [], isLoading: membersLoading } = useTeamMembers()
  const { data: pendingInvites = [] } = usePendingInvites()
  const { data: removedMembers = [] } = useRemovedMembers()
  const removeMember = useRemoveMember()
  const revokeInvite = useRevokeInvite()
  const restoreMember = useRestoreMember()
  const deleteMemberPermanently = useDeleteMemberPermanently()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [removingMember, setRemovingMember] = useState(null)
  const [deletingMember, setDeletingMember] = useState(null)

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
      toast.success(
        `${deletingMember.full_name || 'Member'} permanently deleted`,
      )
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

  if (membersLoading) {
    return (
      <div className="max-w-4xl space-y-8 mx-auto animate-pulse">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-14">
      {/* ── Section: Team Members ── */}
      <section className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-normal tracking-tight">
              Team Members
            </h2>
            <p className="text-sm text-muted-foreground font-normal">
              {members.length} {members.length === 1 ? 'member' : 'members'}{' '}
              with access to your workspace.
            </p>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInviteOpen(true)}
              className="gap-2 w-fit shrink-0"
            >
              <UserPlus size={14} />
              Invite Team Member
            </Button>
          )}
        </div>

        {members.length === 0 ? (
          <Empty className="py-16 border border-dashed rounded-2xl bg-muted/5">
            <EmptyContent>
              <div className="text-4xl leading-none select-none mb-2">👥</div>
              <EmptyHeader>
                <EmptyTitle className="font-normal text-xl">
                  Just you for now
                </EmptyTitle>
                <EmptyDescription className="font-normal">
                  Invite a teammate to collaborate on client accounts and share
                  the workload.
                </EmptyDescription>
              </EmptyHeader>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInviteOpen(true)}
                >
                  <UserPlus className="size-4 mr-2" />
                  Invite Team Member
                </Button>
              )}
            </EmptyContent>
          </Empty>
        ) : (
          <div className="space-y-3">
            {members.map((member) => {
              const isSelf = member.member_user_id === user?.id
              const isOwner = member.system_role === 'admin'
              const displayName = member.full_name || member.email

              return (
                <div
                  key={member.id}
                  className="flex items-center gap-4 rounded-xl border border-border/50 bg-card/30 px-5 py-4"
                >
                  <MemberAvatar
                    name={member.full_name}
                    email={member.email}
                    avatarUrl={member.avatar_url}
                  />

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">
                        {displayName}
                      </p>
                      {isOwner && (
                        <Badge variant="secondary" className="text-xs">
                          Admin
                        </Badge>
                      )}
                      {isSelf && (
                        <Badge variant="outline" className="text-xs">
                          You
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.email}
                    </p>
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
                      Joined {formatDate(member.joined_at)}
                    </div>
                  </div>

                  {isAdmin && !isOwner && !isSelf && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => setRemovingMember(member)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Pending Invites ── */}
      {isAdmin && pendingInvites.length > 0 && (
        <>
          <Separator className="opacity-50" />

          <section className="space-y-8">
            <div className="space-y-1">
              <h2 className="text-2xl font-normal tracking-tight">
                Pending Invites
              </h2>
              <p className="text-sm text-muted-foreground font-normal">
                Active invite links that haven&apos;t been accepted yet.
              </p>
            </div>

            <div className="space-y-3">
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
          </section>
        </>
      )}

      {/* ── Removed Members ── */}
      {isAdmin && removedMembers.length > 0 && (
        <>
          <Separator className="opacity-50" />

          <section className="space-y-8">
            <div className="space-y-1">
              <h2 className="text-2xl font-normal tracking-tight">
                Removed Members
              </h2>
              <p className="text-sm text-muted-foreground font-normal">
                Members who have been removed from your workspace.
              </p>
            </div>

            <div className="space-y-3">
              {removedMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-4 rounded-xl border border-border/50 bg-card/30 px-5 py-4 opacity-60"
                >
                  <MemberAvatar
                    name={member.full_name}
                    email={member.email}
                    avatarUrl={member.avatar_url}
                  />

                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium truncate">
                      {member.full_name || member.email}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.email}
                    </p>
                  </div>

                  {member.functional_role && (
                    <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                      <Briefcase size={12} />
                      {member.functional_role}
                    </div>
                  )}

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
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* ── Dialogs ── */}
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      <AlertDialog
        open={!!deletingMember}
        onOpenChange={(open) => !open && setDeletingMember(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{' '}
              {deletingMember?.full_name || 'this member'} from the database.
              They will need to be re-invited to rejoin. This cannot be undone.
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

      <AlertDialog
        open={!!removingMember}
        onOpenChange={(open) => !open && setRemovingMember(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              {removingMember?.full_name || 'This member'} will lose access to
              your workspace immediately. This action cannot be undone.
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
    </div>
  )
}
