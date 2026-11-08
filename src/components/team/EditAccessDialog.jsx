import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
} from 'react'
import { useAuth } from '@/context/AuthContext'
import { usePermissions } from '@/api/usePermissions'
import {
  useJobRoles,
  useMemberJobRoles,
  createJobRole,
  setMemberJobRoles,
  setMemberResponsibilities,
} from '@/api/jobRoles'
import { nextJobRoleColor } from '@/lib/job-roles'
import JobRolePill from '@/components/team/JobRolePill'
import JobRolePicker from '@/components/team/JobRolePicker'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DOCS_LEVEL_CONFIG, INVITE_ROLE_OPTIONS } from '@/components/team/teamAccessConfig'

function AnimatedHeight({ children }) {
  const outerRef = useRef(null)
  const innerRef = useRef(null)

  useLayoutEffect(() => {
    if (outerRef.current && innerRef.current) {
      outerRef.current.style.height = `${innerRef.current.offsetHeight}px`
    }
  }, [])

  useEffect(() => {
    if (!innerRef.current || !outerRef.current) return
    const ro = new ResizeObserver(() => {
      if (outerRef.current && innerRef.current) {
        outerRef.current.style.height = `${innerRef.current.offsetHeight}px`
      }
    })
    ro.observe(innerRef.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={outerRef}
      className="overflow-hidden"
      style={{ transition: 'height 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  )
}

// ─── Edit Member Dialog ────────────────────────────────────────────────────────

export function EditAccessDialog({ member, open, onOpenChange, onSave, onSaved, onManageJobRoles }) {
  // The owner's own row: descriptive fields are editable, access is not.
  const isOwnerRow =
    member?.system_role === 'owner' || member?.member_user_id === member?.agency_user_id

  const [systemRole, setSystemRole] = useState(
    member?.system_role === 'admin' ? 'admin' : 'member',
  )
  const [docsLevel, setDocsLevel] = useState(
    member?.permissions?.documents || 'view',
  )
  const [rolesAndResponsibilities, setRolesAndResponsibilities] = useState(
    member?.roles_and_responsibilities || '',
  )
  const [saving, setSaving] = useState(false)

  const { isOwner } = usePermissions()
  const { workspaceUserId } = useAuth()
  const queryClient = useQueryClient()
  const canManageJobRoles = isOwner
  const { data: allJobRoles = [] } = useJobRoles()
  const { data: memberJobRoles = {} } = useMemberJobRoles()

  // Held locally so the picker feels immediate; committed on save alongside
  // the access change.
  const [jobRoleIds, setJobRoleIds] = useState([])
  useEffect(() => {
    setJobRoleIds((memberJobRoles[member?.member_user_id] ?? []).map((r) => r.id))
  }, [memberJobRoles, member?.member_user_id])

  const selectedJobRoles = allJobRoles.filter((r) => jobRoleIds.includes(r.id))

  const toggleJobRole = (id) =>
    setJobRoleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const handleCreateJobRole = async (name) => {
    try {
      const created = await createJobRole({ name, color: nextJobRoleColor(allJobRoles.length) })

      // The picker switches the new id on immediately, but the pill is
      // rendered by looking that id up in `allJobRoles` — so without seeding
      // the cache here, a freshly created role vanished until the next
      // refetch. Seed for the instant render, then invalidate so the server
      // stays the source of truth.
      queryClient.setQueryData(['job-roles', 'list', workspaceUserId], (old) =>
        [...(old ?? []), created].sort((a, b) => a.name.localeCompare(b.name)),
      )
      queryClient.invalidateQueries({ queryKey: ['job-roles'] })

      return created
    } catch (err) {
      toast.error(
        err.message?.includes('duplicate') || err.message?.includes('unique')
          ? 'A job role with that name already exists'
          : err.message || 'Failed to create job role',
      )
      return null
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Three narrow operations rather than one wide one: access, job titles
      // and the responsibilities note are separate, separately-auditable
      // writes. That separation is what lets the owner edit their own
      // description while update_member_access still refuses their row.
      if (isOwnerRow) {
        await setMemberResponsibilities(
          member.member_user_id,
          rolesAndResponsibilities.trim() || null,
        )
      } else {
        await onSave(member.id, {
          system_role: systemRole,
          permissions: { documents: systemRole === 'admin' ? 'manage' : docsLevel },
          roles_and_responsibilities: rolesAndResponsibilities.trim() || null,
        })
      }

      // Only the owner may assign job titles, so this is skipped for anyone
      // else. It works on the owner's own row too — they are an ordinary
      // member of agency_members.
      if (canManageJobRoles) {
        await setMemberJobRoles(member.member_user_id, jobRoleIds)
        // setMemberJobRoles is a plain async function, not a mutation with its
        // own onSuccess — nothing else invalidates the by-member map this
        // writes into. Without this, the team table (and every other reader
        // of useMemberJobRoles) kept showing the old titles until an
        // unrelated refetch happened to run.
        queryClient.invalidateQueries({ queryKey: ['job-roles'] })
      }

      if (isOwnerRow) onSaved?.()
      onOpenChange(false)
    } catch (err) {
      toast.error(err.message || 'Failed to update member')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col gap-0 p-0 max-h-[85vh] overflow-hidden">

        {/* Fixed header */}
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <MemberAvatar
              name={member?.full_name}
              email={member?.email}
              avatarUrl={member?.avatar_url}
            />
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base truncate">
                {member?.full_name || member?.email}
              </DialogTitle>
              <DialogDescription className="truncate">
                {member?.email}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="h-px bg-border shrink-0" />

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-5">
          <AnimatedHeight>
          {/* The owner's own row has no editable access — update_member_access
              refuses it in the database, deliberately, so nobody can demote the
              owner. Showing an Access tab that cannot be saved would be a lie,
              so their dialog is Details only. */}
          <Tabs defaultValue={isOwnerRow ? 'details' : 'access'} className="w-full">
            <TabsList className={cn('w-full', isOwnerRow && 'hidden')}>
              <TabsTrigger value="access" className="flex-1">Access</TabsTrigger>
              <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
            </TabsList>

            {/* ── Access tab ── */}
            <TabsContent value="access" className="space-y-5 mt-4">
              <div className="space-y-2">
                <Label>Access level</Label>
                <RadioGroup value={systemRole} onValueChange={setSystemRole} className="gap-2">
                  {INVITE_ROLE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      htmlFor={`role-${opt.value}`}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors',
                        systemRole === opt.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border/50 hover:border-border',
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium">{opt.label}</p>
                          <Badge className={opt.palette.badge}>{opt.palette.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{opt.description}</p>
                      </div>
                      <RadioGroupItem value={opt.value} id={`role-${opt.value}`} className="self-start mt-0.5 data-[state=checked]:border-primary" />
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {systemRole === 'member' && (
                <div className="space-y-2">
                  <Label>Document access</Label>
                  <RadioGroup value={docsLevel} onValueChange={setDocsLevel} className="gap-2">
                    {Object.entries(DOCS_LEVEL_CONFIG).map(([key, cfg]) => (
                      <label
                        key={key}
                        htmlFor={`docs-${key}`}
                        className={cn(
                          'flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors',
                          docsLevel === key
                            ? 'border-primary bg-primary/5'
                            : 'border-border/50 hover:border-border',
                        )}
                      >
                        <cfg.icon className={cn(
                          'size-4 shrink-0 mt-0.5',
                          docsLevel === key ? 'text-primary' : 'text-muted-foreground',
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{cfg.label}</p>
                          <p className="text-xs text-muted-foreground">{cfg.description}</p>
                        </div>
                        <RadioGroupItem value={key} id={`docs-${key}`} className="self-start mt-0.5 data-[state=checked]:border-primary" />
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              )}
            </TabsContent>

            {/* ── Details tab ── */}
            <TabsContent value="details" className="space-y-5 mt-4">
              <div className="space-y-2">
                <Label>Job roles</Label>
                {/* A member can hold several titles, so this is a multi-select
                    over the workspace's own list — replacing the old fixed
                    dropdown plus free-text "Custom…" box, which is what
                    produced near-duplicate titles. Identification only; it
                    never affects access. */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {selectedJobRoles.map((role) => (
                    <JobRolePill
                      key={role.id}
                      role={role}
                      onRemove={canManageJobRoles ? () => toggleJobRole(role.id) : undefined}
                    />
                  ))}
                  <JobRolePicker
                    selectedRoleIds={jobRoleIds}
                    allRoles={allJobRoles}
                    onToggle={toggleJobRole}
                    onCreate={handleCreateJobRole}
                    onManage={onManageJobRoles}
                    canCreate={canManageJobRoles}
                  />
                </div>
                {selectedJobRoles.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No job roles yet — they describe what someone does, not what they can access.
                  </p>
                )}
              </div>

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
                  className="min-h-28 resize-none text-sm"
                />
              </div>
            </TabsContent>
          </Tabs>
          </AnimatedHeight>
        </div>

        <div className="h-px bg-border shrink-0" />

        {/* Fixed footer */}
        <DialogFooter className="px-6 py-4 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
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
