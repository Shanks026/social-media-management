import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createJobRole, deleteJobRole, updateJobRoleColor } from '@/api/jobRoles'
import {
  JOB_ROLE_COLORS,
  JOB_ROLE_COLOR_KEYS,
  getJobRoleColor,
  nextJobRoleColor,
} from '@/lib/job-roles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import JobRolePill from './JobRolePill'

function ColorPicker({ value, onPick }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Choose color"
          className={cn(
            'size-5 shrink-0 rounded-full ring-1 ring-border transition-transform hover:scale-110',
            getJobRoleColor(value).swatch,
          )}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="grid grid-cols-5 gap-1.5">
          {JOB_ROLE_COLOR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              title={JOB_ROLE_COLORS[key].label}
              onClick={() => {
                onPick(key)
                setOpen(false)
              }}
              className={cn(
                'flex size-6 items-center justify-center rounded-full transition-transform hover:scale-110',
                JOB_ROLE_COLORS[key].swatch,
              )}
            >
              {value === key && <Check className="size-3.5 text-white" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * One existing job role. No rename — create and delete only, by decision, so
 * a role's meaning can't shift under the people already holding it.
 */
function JobRoleRow({ role, count, onMutated, canManage }) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => deleteJobRole(role.id),
    onSuccess: () => {
      toast.success('Job role deleted')
      onMutated()
    },
    onError: (err) => toast.error(err.message || 'Failed to delete job role'),
  })

  // Colour is presentation, not identity, so it stays editable even though
  // names deliberately are not.
  const colorMutation = useMutation({
    mutationFn: (color) => updateJobRoleColor(role.id, color),
    onSuccess: onMutated,
    onError: (err) => toast.error(err.message || 'Failed to change colour'),
  })

  return (
    <div className="flex items-center gap-2 py-2">
      {canManage && <ColorPicker value={role.color} onPick={(c) => colorMutation.mutate(c)} />}
      <JobRolePill role={role} />
      <span className="flex-1" />
      <span className="shrink-0 text-xs text-muted-foreground">
        {count} {count === 1 ? 'member' : 'members'}
      </span>
      {canManage && (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => setConfirmOpen(true)}
          title="Delete job role"
        >
          <Trash2 className="size-4" />
        </Button>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{role.name}”?</AlertDialogTitle>
            {/* Deleting cascades through agency_member_job_roles, so the blast
                radius has to be stated before it happens — this is the only
                destructive action in the feature. */}
            <AlertDialogDescription>
              {count > 0
                ? `It will be removed from ${count} ${count === 1 ? 'member' : 'members'}. This can't be undone.`
                : "No one holds this job role. This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/**
 * The workspace's job title list. Owner-only for writes — `canManage` false
 * renders it read-only for an admin, which matches the owner-only RLS.
 *
 * `memberCounts` is a jobRoleId → count map, derived by the caller from
 * useMemberJobRoles() so no extra query is needed.
 */
export default function ManageJobRolesDialog({
  open,
  onOpenChange,
  roles = [],
  memberCounts = {},
  canManage = false,
}) {
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(() => nextJobRoleColor(0))

  const handleMutated = () => {
    queryClient.invalidateQueries({ queryKey: ['job-roles'] })
    // A delete cascades into member links, which the team roster renders.
    queryClient.invalidateQueries({ queryKey: ['team'] })
  }

  const createMutation = useMutation({
    mutationFn: () => createJobRole({ name: newName.trim(), color: newColor }),
    onSuccess: () => {
      handleMutated()
      setNewName('')
      setNewColor(nextJobRoleColor(roles.length + 1))
    },
    onError: (err) =>
      toast.error(
        err.message?.includes('duplicate') || err.message?.includes('unique')
          ? 'A job role with that name already exists'
          : err.message || 'Failed to create job role',
      ),
  })

  function handleCreate() {
    if (!newName.trim()) return
    createMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{canManage ? 'Manage job roles' : 'Job roles'}</DialogTitle>
          <DialogDescription>
            {canManage
              ? 'Job titles for your workspace. They identify what people do — they never affect access.'
              : 'Job titles for your workspace. Only the workspace owner can change these.'}
          </DialogDescription>
        </DialogHeader>

        {roles.length > 0 ? (
          <div className="max-h-[50vh] divide-y overflow-y-auto">
            {roles.map((role) => (
              <JobRoleRow
                key={role.id}
                role={role}
                count={memberCounts[role.id] ?? 0}
                onMutated={handleMutated}
                canManage={canManage}
              />
            ))}
          </div>
        ) : (
          <Empty>
            <EmptyMedia>
              <span className="text-5xl">🏷️</span>
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="font-bold text-xl">No job roles yet</EmptyTitle>
              <EmptyDescription>
                {canManage
                  ? 'Add the titles your team actually uses — Designer, Video Editor, Account Manager.'
                  : 'The workspace owner has not defined any job roles yet.'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {canManage && (
          <div className="flex items-center gap-2 border-t pt-3">
            <ColorPicker value={newColor} onPick={setNewColor} />
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCreate()
                }
              }}
              placeholder="New job role…"
              className="h-8 flex-1 text-sm"
            />
            <Button
              size="sm"
              className="h-8 shrink-0"
              disabled={!newName.trim() || createMutation.isPending}
              onClick={handleCreate}
            >
              Add
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
