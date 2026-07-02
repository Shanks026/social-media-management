import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { usePermissions } from '@/api/usePermissions'
import {
  useTeamMembers,
  usePendingInvites,
  useGenerateInvite,
  useRevokeInvite,
  useRemoveMember,
  useRemovedMembers,
  useRestoreMember,
  useDeleteMemberPermanently,
  updateMemberAccess,
} from '@/api/team'
import {
  SYSTEM_ROLE_PALETTE,
  AGENCY_ROLE_GROUPS,
  getRolePalette,
} from '@/lib/team-roles'
import { formatDate } from '@/lib/helper'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { teamKeys } from '@/api/team'
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Textarea } from '@/components/ui/textarea'
import {
  UserPlus,
  Copy,
  Check,
  Link,
  Trash2,
  CalendarDays,
  Briefcase,
  Clock,
  Loader2,
  RotateCcw,
  ShieldCheck,
  ShieldMinus,
  FileText,
  Pencil,
} from 'lucide-react'
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'

// ─── Documents level labels ────────────────────────────────────────────────────

const DOCS_LEVEL_CONFIG = {
  none: { label: 'No access', description: 'Cannot see the documents section' },
  view: { label: 'View', description: 'Can read non-confidential documents' },
  manage: {
    label: 'Manage',
    description: 'Can upload, edit, and delete non-confidential documents',
  },
}

// ─── Invite Dialog ─────────────────────────────────────────────────────────────

const INVITE_ROLE_OPTIONS = [
  {
    value: 'member',
    label: 'Team Member',
    description: 'Access to client work, posts, calendar, and documents.',
    palette: SYSTEM_ROLE_PALETTE.member,
  },
  {
    value: 'admin',
    label: 'Team Admin',
    description:
      'Full access including finance, proposals, prospects, and reports.',
    palette: SYSTEM_ROLE_PALETTE.admin,
  },
]

export function InviteDialog({ open, onOpenChange }) {
  const [systemRole, setSystemRole] = useState('member')
  const [inviteUrl, setInviteUrl] = useState(null)
  const [copied, setCopied] = useState(false)

  const generateInvite = useGenerateInvite()

  const handleClose = (val) => {
    onOpenChange(val)
    if (!val) {
      setTimeout(() => {
        setSystemRole('member')
        setInviteUrl(null)
        setCopied(false)
      }, 200)
    }
  }

  const handleGenerate = async () => {
    try {
      const url = await generateInvite.mutateAsync({ system_role: systemRole })
      setInviteUrl(url)
    } catch (err) {
      const msg =
        err.message === 'TEAM_SEAT_LIMIT_REACHED'
          ? 'Team seat limit reached. Upgrade your plan to invite more members.'
          : err.message || 'Failed to generate invite link'
      toast.error(msg)
    }
  }

  const handleCopy = () => {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const selectedOption = INVITE_ROLE_OPTIONS.find((o) => o.value === systemRole)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            {inviteUrl
              ? 'Share this link. It expires in 7 days.'
              : 'Choose the access level for this invite. The new member will set their own job title.'}
          </DialogDescription>
        </DialogHeader>

        {!inviteUrl ? (
          <div className="space-y-4">
            <div className="space-y-2">
              {INVITE_ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSystemRole(opt.value)}
                  className={cn(
                    'w-full flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                    systemRole === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border/50 hover:border-border',
                  )}
                >
                  <div
                    className={cn(
                      'mt-0.5 size-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                      systemRole === opt.value
                        ? 'border-primary'
                        : 'border-muted-foreground/40',
                    )}
                  >
                    {systemRole === opt.value && (
                      <div className="size-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center gap-2 mb-1">
                      <p className="text-sm font-medium">{opt.label}</p>
                      <Badge className={opt.palette.badge}>
                        {opt.palette.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {opt.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={generateInvite.isPending}
            >
              {generateInvite.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Generating…
                </>
              ) : (
                <>
                  <Link className="size-4 mr-2" />
                  Generate Invite Link
                </>
              )}
            </Button>
          </div>
        ) : (
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
              Expires in 7 days. Whoever uses this link joins as a{' '}
              <span
                className={cn(
                  'font-medium',
                  selectedOption?.palette.badge
                    .split(' ')
                    .find((c) => c.startsWith('text-')),
                )}
              >
                {selectedOption?.label}
              </span>
              .
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                setInviteUrl(null)
                setSystemRole('member')
              }}
            >
              Create another invite
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Member Dialog ────────────────────────────────────────────────────────

export function EditAccessDialog({ member, open, onOpenChange, onSave }) {
  const [functionalRole, setFunctionalRole] = useState(
    member?.functional_role || '',
  )
  const [customRole, setCustomRole] = useState('')
  const [docsLevel, setDocsLevel] = useState(
    member?.permissions?.documents || 'view',
  )
  const [rolesAndResponsibilities, setRolesAndResponsibilities] = useState(
    member?.roles_and_responsibilities || '',
  )
  const [saving, setSaving] = useState(false)

  const isCustom =
    functionalRole !== '' &&
    !AGENCY_ROLE_GROUPS.flatMap((g) => g.roles).includes(functionalRole)

  const handleSave = async () => {
    setSaving(true)
    try {
      const resolvedRole =
        functionalRole === '__custom__'
          ? customRole.trim()
          : functionalRole || member?.functional_role || null
      await onSave(member.id, {
        system_role: member.system_role,
        permissions: { documents: docsLevel },
        functional_role: resolvedRole,
        roles_and_responsibilities: rolesAndResponsibilities.trim() || null,
      })
      onOpenChange(false)
    } catch (err) {
      toast.error(err.message || 'Failed to update member')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit member</DialogTitle>
          <DialogDescription>
            Update details for {member?.full_name || 'this member'}. Roles &amp;
            responsibilities are only visible to you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Job title / functional role */}
          <div className="space-y-2">
            <Label>Role / Job title</Label>
            <Select
              value={isCustom ? '__custom__' : functionalRole}
              onValueChange={(v) => {
                setFunctionalRole(v)
                if (v !== '__custom__') setCustomRole('')
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {AGENCY_ROLE_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.roles.map((role) => (
                      <SelectItem key={role} value={role}>
                        <span className="flex items-center gap-2">
                          <span className={cn('size-2 rounded-full shrink-0', getRolePalette(role)?.dot ?? 'bg-muted-foreground/30')} />
                          {role}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
                <SelectGroup>
                  <SelectLabel>Other</SelectLabel>
                  <SelectItem value="__custom__">Custom…</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            {(functionalRole === '__custom__' || isCustom) && (
              <Input
                placeholder="e.g. Paralegal, Video Producer…"
                value={customRole || (isCustom ? member.functional_role : '')}
                onChange={(e) => setCustomRole(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          {/* Document access (members only) */}
          {member?.system_role === 'member' && (
            <div className="space-y-2">
              <Label>Document access</Label>
              <div className="space-y-2">
                {Object.entries(DOCS_LEVEL_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDocsLevel(key)}
                    className={cn(
                      'w-full flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                      docsLevel === key
                        ? 'border-primary bg-primary/5'
                        : 'border-border/50 hover:border-border',
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 size-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                        docsLevel === key
                          ? 'border-primary'
                          : 'border-muted-foreground/40',
                      )}
                    >
                      {docsLevel === key && (
                        <div className="size-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{cfg.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {cfg.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Roles & Responsibilities — owner-only internal note */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Roles &amp; Responsibilities</Label>
              <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                Only visible to you
              </span>
            </div>
            <Textarea
              placeholder="Describe this member's responsibilities, focus areas, or internal notes…"
              value={rolesAndResponsibilities}
              onChange={(e) => setRolesAndResponsibilities(e.target.value)}
              className="min-h-24 resize-none text-sm"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin mr-2" />}
              Save changes
            </Button>
          </div>
        </div>
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

export default function TeamSettings({ onInviteClick = () => {} }) {
  const { user } = useAuth()
  const { canManageTeam } = usePermissions()
  const queryClient = useQueryClient()

  const { data: members = [], isLoading: membersLoading } = useTeamMembers()
  const { data: pendingInvites = [] } = usePendingInvites()
  const { data: removedMembers = [] } = useRemovedMembers()
  const removeMember = useRemoveMember()
  const revokeInvite = useRevokeInvite()
  const restoreMember = useRestoreMember()
  const deleteMemberPermanently = useDeleteMemberPermanently()
  const { workspaceUserId } = useAuth()

  const [removingMember, setRemovingMember] = useState(null)
  const [deletingMember, setDeletingMember] = useState(null)
  const [editingMember, setEditingMember] = useState(null)

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

  const handlePromote = async (member) => {
    try {
      await updateMemberAccess(member.id, {
        system_role: 'admin',
        permissions: { documents: 'manage' },
        functional_role: null,
      })
      queryClient.invalidateQueries({
        queryKey: teamKeys.members(workspaceUserId),
      })
      toast.success(`${member.full_name || 'Member'} promoted to Admin`)
    } catch (err) {
      toast.error(err.message || 'Failed to promote member')
    }
  }

  const handleDemote = async (member) => {
    try {
      await updateMemberAccess(member.id, {
        system_role: 'member',
        permissions: { documents: 'view' },
        functional_role: null,
      })
      queryClient.invalidateQueries({
        queryKey: teamKeys.members(workspaceUserId),
      })
      toast.success(`${member.full_name || 'Member'} demoted to Member`)
    } catch (err) {
      toast.error(err.message || 'Failed to demote member')
    }
  }

  const handleSaveAccess = async (memberId, payload) => {
    await updateMemberAccess(memberId, payload)
    queryClient.invalidateQueries({
      queryKey: teamKeys.members(workspaceUserId),
    })
    toast.success('Access updated')
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
    <div className="max-w-4xl space-y-8 mx-auto animate-in fade-in duration-700">
      {/* ── Section: Team Members ── */}
      <section className="space-y-8">
        {members.length === 0 ? (
          <Empty className="py-16 border border-dashed rounded-2xl bg-muted/5">
            <EmptyContent>
              <div className="text-4xl leading-none select-none mb-2">👥</div>
              <EmptyHeader>
                <EmptyTitle className="font-bold text-xl">
                  Just you for now
                </EmptyTitle>
                <EmptyDescription className="font-normal">
                  Invite a teammate to collaborate on client accounts and share
                  the workload.
                </EmptyDescription>
              </EmptyHeader>
              {canManageTeam && (
                <Button variant="outline" size="sm" onClick={onInviteClick}>
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
              const isOwnerRow = member.system_role === 'owner'
              const isAdminRow = member.system_role === 'admin'
              const displayName = member.full_name || member.email
              const rolePalette =
                SYSTEM_ROLE_PALETTE[member.system_role] ??
                SYSTEM_ROLE_PALETTE.member
              const funcPalette = getRolePalette(member.functional_role)
              const docsLevel =
                isOwnerRow || isAdminRow
                  ? null
                  : (member.permissions?.documents ?? 'view')

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

                      {/* System-role badge */}
                      <Badge className={rolePalette.badge}>
                        {rolePalette.label}
                      </Badge>

                      {/* Functional role */}
                      {member.functional_role && funcPalette && (
                        <Badge variant="outline" className="gap-1.5">
                          <span
                            className={cn(
                              'size-1.5 rounded-full shrink-0',
                              funcPalette.dot,
                            )}
                          />
                          {member.functional_role}
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

                  <div className="hidden sm:flex items-center gap-4 shrink-0">
                    {/* Documents level chip (members only) */}
                    {docsLevel && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <FileText size={12} className="shrink-0" />
                        {DOCS_LEVEL_CONFIG[docsLevel]?.label ?? docsLevel}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays size={12} className="shrink-0" />
                      Joined {formatDate(member.joined_at)}
                    </div>
                  </div>

                  {/* Owner-only action buttons (not on own row, not on owner row) */}
                  {canManageTeam && !isSelf && !isOwnerRow && (
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Promote / Demote */}
                      {isAdminRow ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-foreground"
                              onClick={() => handleDemote(member)}
                            >
                              <ShieldMinus className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Demote to Member</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-foreground"
                              onClick={() => handlePromote(member)}
                            >
                              <ShieldCheck className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Promote to Admin</TooltipContent>
                        </Tooltip>
                      )}

                      {/* Edit member */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setEditingMember(member)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit member</TooltipContent>
                      </Tooltip>

                      {/* Remove */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setRemovingMember(member)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove member</TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Pending Invites (owner only) ── */}
      {canManageTeam && pendingInvites.length > 0 && (
        <>
          <Separator className="opacity-50" />
          <section className="space-y-8">
            <div className="space-y-1">
              <h2 className="text-2xl font-normal tracking-tight bricolage">
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-mono text-muted-foreground truncate">
                        /join/{invite.token.slice(0, 20)}…
                      </p>
                      {invite.system_role && (
                        <Badge
                          className={
                            SYSTEM_ROLE_PALETTE[invite.system_role]?.badge ??
                            SYSTEM_ROLE_PALETTE.member.badge
                          }
                        >
                          {SYSTEM_ROLE_PALETTE[invite.system_role]?.label ??
                            'Member'}
                        </Badge>
                      )}
                    </div>
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

      {/* ── Removed Members (owner only) ── */}
      {canManageTeam && removedMembers.length > 0 && (
        <>
          <Separator className="opacity-50" />
          <section className="space-y-8">
            <div className="space-y-1">
              <h2 className="text-2xl font-normal tracking-tight bricolage">
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

      {/* ── Edit Access Dialog ── */}
      {editingMember && (
        <EditAccessDialog
          member={editingMember}
          open={!!editingMember}
          onOpenChange={(v) => !v && setEditingMember(null)}
          onSave={handleSaveAccess}
        />
      )}

      {/* ── Confirm dialogs ── */}
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
              your workspace immediately.
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
