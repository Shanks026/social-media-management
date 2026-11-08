import { useState, useLayoutEffect } from 'react'
import {
  useGenerateInvite,
  DEFAULT_INVITE_EXPIRY_DAYS,
  MAX_INVITE_EXPIRY_DAYS,
  inviteExpiryInDays,
  endOfDay,
} from '@/api/team'
import { formatDate } from '@/lib/helper'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  Copy,
  Check,
  Link,
  CalendarDays,
  Loader2,
  FolderOpen,
  ArrowLeft,
} from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DOCS_LEVEL_CONFIG, INVITE_ROLE_OPTIONS } from '@/components/team/teamAccessConfig'

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

// DEFAULT_INVITE_EXPIRY_DAYS / MAX_INVITE_EXPIRY_DAYS and the date helpers now
// all come from @/api/team, so this dialog and the onboarding invite step share
// one source of truth — including the end-of-day rule, which the picker below
// depends on to not issue a link that expires the morning it is labelled with.

/**
 * `onGenerated` is optional — onboarding uses it to record that the owner
 * actually created an invite, so the setup checklist reflects it.
 */
export function InviteDialog({ open, onOpenChange, onGenerated }) {
  const [step, setStep] = useState(1)
  const [label, setLabel] = useState('')
  const [systemRole, setSystemRole] = useState('member')
  const [docsLevel, setDocsLevel] = useState('view')
  const [expiryDate, setExpiryDate] = useState(() => inviteExpiryInDays(DEFAULT_INVITE_EXPIRY_DAYS))
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
    setExpiryDate(inviteExpiryInDays(DEFAULT_INVITE_EXPIRY_DAYS))
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
      onGenerated?.(url)
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
                    // react-day-picker hands back local midnight; endOfDay
                    // makes the label and the actual expiry agree.
                    onSelect={(date) => date && setExpiryDate(endOfDay(date))}
                    disabled={(date) =>
                      date < new Date(new Date().setHours(0, 0, 0, 0)) ||
                      date > inviteExpiryInDays(MAX_INVITE_EXPIRY_DAYS)
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
                  Expires {formatDate(expiryDate)}. Anyone who uses it before then joins as a{' '}
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
