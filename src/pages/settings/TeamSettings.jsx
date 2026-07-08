import { useState, useRef, useEffect, useLayoutEffect } from 'react'
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
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
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
  Ban,
  Eye,
  FolderOpen,
  ArrowLeft,
} from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'

// ─── Documents level labels ────────────────────────────────────────────────────

export const DOCS_LEVEL_CONFIG = {
  none: { label: 'No access', description: 'Cannot see the documents section', icon: Ban },
  view: { label: 'View', description: 'Can read non-confidential documents', icon: Eye },
  manage: { label: 'Manage', description: 'Can upload, edit, and delete non-confidential documents', icon: FolderOpen },
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

// ── Stepper indicator (same pattern as UploadMetaDialog) ────────────────────

function StepDot({ number, label, state }) {
  return (
    <div className="flex items-center gap-2 min-w-0 shrink">
      <div
        className={cn(
          'flex size-6 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300',
          state === 'completed' && 'bg-primary text-primary-foreground',
          state === 'active' && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
          state === 'upcoming' && 'bg-muted text-muted-foreground',
        )}
      >
        {state === 'completed' ? <Check className="size-3" strokeWidth={3} /> : number}
      </div>
      <span
        className={cn(
          'text-sm font-medium truncate transition-colors duration-300',
          state === 'upcoming' && 'text-muted-foreground',
        )}
      >
        {label}
      </span>
    </div>
  )
}

const DEFAULT_INVITE_EXPIRY_DAYS = 7
const MAX_INVITE_EXPIRY_DAYS = 30

function addDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

export function InviteDialog({ open, onOpenChange }) {
  const [step, setStep] = useState(1)
  const [label, setLabel] = useState('')
  const [systemRole, setSystemRole] = useState('member')
  const [docsLevel, setDocsLevel] = useState('view')
  const [expiryDate, setExpiryDate] = useState(() => addDays(DEFAULT_INVITE_EXPIRY_DAYS))
  const [inviteUrl, setInviteUrl] = useState(null)
  const [copied, setCopied] = useState(false)

  const generateInvite = useGenerateInvite()

  // Each panel sizes the dialog to its own natural content height (instead of
  // a fixed height for both) — measured via ResizeObserver so it re-adjusts
  // whenever a panel's content changes (e.g. admin vs member on panel 2).
  // State-backed callback refs (not useRef) because Radix mounts DialogContent
  // into the DOM on a tick that isn't guaranteed to line up with the `open`
  // prop change — a plain ref + effect-on-[open] can fire before the node
  // exists and never re-run. Callback refs fire exactly when the node appears.
  const [panel1El, setPanel1El] = useState(null)
  const [panel2El, setPanel2El] = useState(null)
  const [panelHeights, setPanelHeights] = useState({ 1: null, 2: null })
  const activeStep = inviteUrl ? 2 : step
  const activeHeight = panelHeights[activeStep]

  useLayoutEffect(() => {
    const els = { 1: panel1El, 2: panel2El }
    const measure = () =>
      setPanelHeights({ 1: els[1]?.offsetHeight ?? null, 2: els[2]?.offsetHeight ?? null })
    measure()
    const ro = new ResizeObserver(measure)
    if (els[1]) ro.observe(els[1])
    if (els[2]) ro.observe(els[2])
    return () => ro.disconnect()
  }, [panel1El, panel2El])

  const resetForm = () => {
    setStep(1)
    setLabel('')
    setSystemRole('member')
    setDocsLevel('view')
    setExpiryDate(addDays(DEFAULT_INVITE_EXPIRY_DAYS))
    setInviteUrl(null)
    setCopied(false)
  }

  const handleClose = (val) => {
    onOpenChange(val)
    if (!val) setTimeout(resetForm, 200)
  }

  const handleGenerate = async () => {
    try {
      const permissions = { documents: systemRole === 'admin' ? 'manage' : docsLevel }
      const url = await generateInvite.mutateAsync({
        system_role: systemRole,
        permissions,
        expires_at: expiryDate.toISOString(),
        label,
      })
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
      <DialogContent className="w-[90vw] max-w-md overflow-hidden p-0 gap-0">

        {/* ── Stepper header ─────────────────────────────────────────────── */}
        <div className="pl-6 pr-12 pt-6 pb-5 border-b">
          <DialogTitle className="text-base font-semibold mb-4">Invite Team Member</DialogTitle>

          <div className="flex items-center gap-2 min-w-0">
            <StepDot
              number={1}
              label="Link details"
              state={inviteUrl || step > 1 ? 'completed' : 'active'}
            />

            {/* Animated connector */}
            <div className="relative flex-1 h-px bg-border overflow-hidden">
              <div
                className="absolute inset-0 bg-primary origin-left transition-transform duration-500 ease-in-out"
                style={{ transform: step > 1 || inviteUrl ? 'scaleX(1)' : 'scaleX(0)' }}
              />
            </div>

            <StepDot
              number={2}
              label="Document access"
              state={step === 2 || inviteUrl ? 'active' : 'upcoming'}
            />
          </div>
        </div>

        {/* ── Sliding panels — height animates to match whichever panel is active ── */}
        <div
          className="relative overflow-x-hidden overflow-y-auto max-h-[65vh] transition-[height] duration-300 ease-in-out"
          style={{ height: activeHeight ? `${activeHeight}px` : 'auto' }}
        >

          {/* ── Panel 1: Link details + access level ── */}
          <div
            ref={setPanel1El}
            className="absolute top-0 left-0 right-0 p-6 space-y-4 transition-transform duration-300 ease-in-out"
            style={{ transform: step === 2 || inviteUrl ? 'translateX(-100%)' : 'translateX(0)' }}
            aria-hidden={step !== 1}
          >
            <div className="space-y-1.5">
              <Label>
                Link name <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                placeholder="e.g. Batch for Jenit"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Expires on</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarDays className="mr-2 size-4 opacity-50" />
                    {formatDate(expiryDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={expiryDate}
                    onSelect={(date) => date && setExpiryDate(date)}
                    disabled={(date) =>
                      date < new Date(new Date().setHours(0, 0, 0, 0)) ||
                      date > addDays(MAX_INVITE_EXPIRY_DAYS)
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Up to {MAX_INVITE_EXPIRY_DAYS} days from today.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Access level</Label>
              <RadioGroup value={systemRole} onValueChange={setSystemRole} className="gap-2">
                {INVITE_ROLE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    htmlFor={`invite-role-${opt.value}`}
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
                        <Badge className={opt.palette.badge}>
                          {opt.palette.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {opt.description}
                      </p>
                    </div>
                    <RadioGroupItem
                      value={opt.value}
                      id={`invite-role-${opt.value}`}
                      className="self-start mt-0.5 data-[state=checked]:border-primary"
                    />
                  </label>
                ))}
              </RadioGroup>
            </div>
          </div>

          {/* ── Panel 2: Document access, then the generated result ── */}
          <div
            ref={setPanel2El}
            className="absolute top-0 left-0 right-0 p-6 transition-transform duration-300 ease-in-out"
            style={{ transform: step === 2 || inviteUrl ? 'translateX(0)' : 'translateX(100%)' }}
            aria-hidden={step !== 2 && !inviteUrl}
          >
            {!inviteUrl ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This invite joins as{' '}
                  <span
                    className={cn(
                      'font-medium',
                      selectedOption?.palette.badge.split(' ').find((c) => c.startsWith('text-')),
                    )}
                  >
                    {selectedOption?.label}
                  </span>
                  . The new member will set their own job title.
                </p>

                {systemRole === 'member' ? (
                  <div className="space-y-2">
                    <Label>Document access</Label>
                    <RadioGroup value={docsLevel} onValueChange={setDocsLevel} className="gap-2">
                      {Object.entries(DOCS_LEVEL_CONFIG).map(([key, cfg]) => (
                        <label
                          key={key}
                          htmlFor={`invite-docs-${key}`}
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
                          <RadioGroupItem
                            value={key}
                            id={`invite-docs-${key}`}
                            className="self-start mt-0.5 data-[state=checked]:border-primary"
                          />
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 flex items-start gap-3">
                    <FolderOpen className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Full document access</p>
                      <p className="text-xs text-muted-foreground">
                        Admins can upload, edit, and delete documents — nothing to choose here.
                      </p>
                    </div>
                  </div>
                )}
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
                  Expires {formatDate(expiryDate)}. Whoever uses this link joins as a{' '}
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
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-t">
          <div>
            {step === 2 && !inviteUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => setStep(1)}
              >
                <ArrowLeft className="size-3.5" />
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!inviteUrl ? (
              step === 1 ? (
                <Button onClick={() => setStep(2)}>Continue</Button>
              ) : (
                <Button onClick={handleGenerate} disabled={generateInvite.isPending}>
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
              )
            ) : (
              <>
                <Button variant="outline" onClick={resetForm}>
                  Create another invite
                </Button>
                <Button onClick={() => handleClose(false)}>Done</Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Animated height wrapper ───────────────────────────────────────────────────
// Measures the inner content height with ResizeObserver and applies it as an
// explicit pixel value on the outer wrapper so CSS can transition it.

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

export function EditAccessDialog({ member, open, onOpenChange, onSave }) {
  const [systemRole, setSystemRole] = useState(
    member?.system_role === 'admin' ? 'admin' : 'member',
  )
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
        system_role: systemRole,
        permissions: { documents: systemRole === 'admin' ? 'manage' : docsLevel },
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
                {member?.functional_role && (
                  <span className="text-muted-foreground/60"> · {member.functional_role}</span>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="h-px bg-border shrink-0" />

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-5">
          <AnimatedHeight>
          <Tabs defaultValue="access" className="w-full">
            <TabsList className="w-full">
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

      {/* ── Active Links (owner only) ── */}
      {canManageTeam && pendingInvites.length > 0 && (
        <>
          <Separator className="opacity-50" />
          <section className="space-y-8">
            <div className="space-y-1">
              <h2 className="text-2xl font-normal tracking-tight bricolage">
                Active Links
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

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-semibold truncate">
                        {invite.label || `/join/${invite.token.slice(0, 20)}…`}
                      </p>
                      {invite.permissions?.documents && (() => {
                        const docsCfg = DOCS_LEVEL_CONFIG[invite.permissions.documents]
                        const DocsIcon = docsCfg?.icon
                        if (!DocsIcon) return null
                        return (
                          <DocsIcon
                            className="size-4 text-muted-foreground shrink-0"
                            title={`Document access: ${docsCfg.label}`}
                          />
                        )
                      })()}
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
                    {invite.label && (
                      <p className="text-xs font-mono text-muted-foreground/70 truncate">
                        /join/{invite.token.slice(0, 20)}…
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays size={13} />
                        Created {formatDate(invite.created_at)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} />
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
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This deletes {deletingMember?.full_name || 'this member'}&apos;s login entirely — they
                  would need a brand new account to ever rejoin. Deliverables, tasks, and chat messages
                  they created stay exactly as they are, but will now show{' '}
                  <span className="font-medium text-foreground">you</span> as the author instead of them.
                </p>
                <p>
                  If they belong to another Tercero workspace, their login is left intact and only their
                  access and data here are removed.
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
