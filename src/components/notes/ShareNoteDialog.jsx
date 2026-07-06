import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { X, UserPlus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useTeamMembers } from '@/api/team'
import {
  useNoteShares,
  noteShareKeys,
  shareNoteWithMany,
  updateNoteSharePermission,
  removeNoteShare,
} from '@/api/noteShares'

function MemberAvatar({ member, size = 'size-7' }) {
  if (member?.avatar_url) {
    return (
      <img
        src={member.avatar_url}
        alt=""
        className={`${size} rounded-full object-cover shrink-0 ring-1 ring-border`}
      />
    )
  }
  return (
    <div className={`${size} rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary shrink-0`}>
      {(member?.full_name || member?.email || '?')[0].toUpperCase()}
    </div>
  )
}

export default function ShareNoteDialog({ open, onOpenChange, noteId }) {
  const queryClient = useQueryClient()
  const { data: teamMembers = [] } = useTeamMembers()
  const { data: shares = [], isLoading } = useNoteShares(noteId)
  const [selectedIds, setSelectedIds] = useState([])

  const memberMap = useMemo(
    () => Object.fromEntries(teamMembers.map((m) => [m.member_user_id, m])),
    [teamMembers],
  )

  const sharedIds = useMemo(() => new Set(shares.map((s) => s.member_user_id)), [shares])
  const availableMembers = useMemo(
    () => teamMembers.filter((m) => !sharedIds.has(m.member_user_id)),
    [teamMembers, sharedIds],
  )

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: noteShareKeys.list(noteId) })
    queryClient.invalidateQueries({ queryKey: ['agency-notes', 'detail', noteId] })
    queryClient.invalidateQueries({ queryKey: ['agency-notes', 'list'] })
  }

  const addMutation = useMutation({
    mutationFn: shareNoteWithMany,
    onSuccess: () => {
      invalidateAll()
      setSelectedIds([])
    },
    onError: (err) => toast.error(err.message || 'Failed to share note'),
  })

  const permissionMutation = useMutation({
    mutationFn: ({ shareId, permission }) => updateNoteSharePermission(shareId, permission),
    onSuccess: invalidateAll,
    onError: (err) => toast.error(err.message || 'Failed to update permission'),
  })

  const removeMutation = useMutation({
    mutationFn: removeNoteShare,
    onSuccess: invalidateAll,
    onError: (err) => toast.error(err.message || 'Failed to remove access'),
  })

  function toggleSelected(memberId) {
    setSelectedIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId],
    )
  }

  function handleAdd() {
    if (selectedIds.length === 0) return
    addMutation.mutate({ noteId, memberUserIds: selectedIds, permission: 'read' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share note</DialogTitle>
          <DialogDescription>
            Invite specific teammates to view or edit this note.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Add people</p>
          {availableMembers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3 rounded-md border border-dashed">
              Everyone already has access
            </p>
          ) : (
            <div className="max-h-40 overflow-y-auto rounded-md border divide-y divide-border/50">
              {availableMembers.map((m) => {
                const checked = selectedIds.includes(m.member_user_id)
                return (
                  <label
                    key={m.member_user_id}
                    htmlFor={`share-member-${m.member_user_id}`}
                    className="flex items-center gap-2.5 px-2.5 py-2 cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    <Checkbox
                      id={`share-member-${m.member_user_id}`}
                      checked={checked}
                      onCheckedChange={() => toggleSelected(m.member_user_id)}
                    />
                    <MemberAvatar member={m} size="size-6" />
                    <span className="flex-1 truncate text-sm">{m.full_name || m.email}</span>
                  </label>
                )
              })}
            </div>
          )}
          <Button
            size="sm"
            className="w-full h-9 gap-1.5"
            disabled={selectedIds.length === 0 || addMutation.isPending}
            onClick={handleAdd}
          >
            <UserPlus className="size-3.5" />
            {selectedIds.length > 0 ? `Add ${selectedIds.length} ${selectedIds.length === 1 ? 'person' : 'people'}` : 'Add'}
          </Button>
        </div>

        <div className="space-y-1 max-h-64 overflow-y-auto">
          {isLoading ? (
            <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
          ) : shares.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Not shared with anyone yet.
            </p>
          ) : (
            shares.map((share) => {
              const member = memberMap[share.member_user_id]
              return (
                <div key={share.id} className="flex items-center gap-2.5 rounded-md px-1 py-1.5">
                  <MemberAvatar member={member} />
                  <span className="flex-1 truncate text-sm">
                    {member?.full_name || member?.email || 'Unknown member'}
                  </span>
                  <Select
                    value={share.permission}
                    onValueChange={(v) => permissionMutation.mutate({ shareId: share.id, permission: v })}
                  >
                    <SelectTrigger className="h-7 w-24 text-xs shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read">Read</SelectItem>
                      <SelectItem value="write">Write</SelectItem>
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => removeMutation.mutate(share.id)}
                    className="text-muted-foreground hover:text-destructive p-1"
                    title="Remove access"
                    aria-label={`Remove ${member?.full_name || 'member'}'s access`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )
            })
          )}
        </div>

        <DialogFooter className="sm:justify-start">
          <p className="text-xs text-muted-foreground">
            Only you can manage who has access to this note.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
