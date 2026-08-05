import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Building2,
  Check,
  ImagePlus,
  PenLine,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { PolarAngleAxis, RadialBar, RadialBarChart } from 'recharts'

import { ChartContainer } from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { usePermissions } from '@/api/usePermissions'
import { useSubscription } from '@/api/useSubscription'
import { usePendingInvites, useTeamMembers } from '@/api/team'
import { dismissSetupChecklist } from '@/api/agency'

/**
 * "Finish setting up" checklist for the dashboard.
 *
 * Two separate concerns, deliberately:
 *
 *  - **Whether the card shows at all** is gated on `onboarding_skipped_steps`
 *    being non-empty. Established workspaces were backfilled to `'{}'`, so this
 *    never nags anyone who onboarded before it existed.
 *  - **What it lists** is the full canonical set below, not just the skipped
 *    keys — so a step completed during onboarding shows ticked instead of
 *    disappearing, and progress reads as progress.
 *
 * Done-ness is always derived from live data, so completing an item anywhere in
 * the app ticks it off here with no sync step.
 */
const CHECKLIST_STEPS = [
  {
    key: 'agency',
    icon: Building2,
    label: 'Set up your agency',
    description: 'Your name, branding and contact details.',
    to: '/settings?tab=agency',
    // Always true by the time the dashboard renders — onboarding wrote it. It's
    // here so the checklist opens with a win rather than at 0%.
    isDone: ({ sub }) => !!sub?.agency_name?.trim(),
  },
  {
    key: 'logos',
    icon: ImagePlus,
    label: 'Add your logos',
    description:
      'Square for the sidebar and avatars, horizontal for invoices and proposals.',
    to: '/settings?tab=agency',
    // Both are optional during onboarding and used in different places, so this
    // only ticks once the workspace has each of them.
    isDone: ({ sub }) => !!sub?.logo_url && !!sub?.logo_horizontal_url,
  },
  {
    key: 'signatory',
    icon: PenLine,
    label: 'Add your invoice signatory',
    description: 'Signs off every invoice you send.',
    to: '/settings?tab=invoice',
    isDone: ({ sub }) => !!sub?.signatory_name || !!sub?.signature_url,
  },
  {
    key: 'invite_team',
    icon: Users,
    label: 'Invite your team',
    description: 'Share one link to give teammates workspace access.',
    to: '/team',
    // A pending invite counts: the step asks the owner to invite someone, and
    // whether that person accepts isn't in their control. Without this the card
    // couldn't be dismissed until a third party acted.
    isDone: ({ hasTeammates, hasPendingInvite }) =>
      hasTeammates || hasPendingInvite,
  },
  {
    key: 'first_client',
    icon: UserPlus,
    label: 'Add your first client',
    description: 'Start scheduling content and tracking work.',
    to: '/clients/create',
    isDone: ({ sub }) => (sub?.client_count ?? 0) > 0,
  },
]

/**
 * Colour carries the same information as the number, so the ring reads before
 * it's parsed: amber early on, blue in progress, green when finished.
 */
function ringColor(percent) {
  if (percent >= 100) return '#16a34a' // green-600
  if (percent >= 50) return '#0ea5e9' // sky-500
  return '#f59e0b' // amber-500
}

function ProgressRing({ percent }) {
  const color = ringColor(percent)

  return (
    <div className="relative size-18 shrink-0">
      <ChartContainer
        config={{ value: { label: 'Setup progress' } }}
        className="aspect-square size-18"
      >
        {/* startAngle/endAngle spanning 360° with a fixed 0-100 PolarAngleAxis
            domain is what makes the bar length track the percentage. */}
        <RadialBarChart
          data={[{ name: 'progress', value: percent }]}
          startAngle={90}
          endAngle={-270}
          innerRadius="74%"
          outerRadius="100%"
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            angleAxisId={0}
            tick={false}
            axisLine={false}
          />
          <RadialBar
            dataKey="value"
            angleAxisId={0}
            background
            cornerRadius={8}
            fill={color}
            isAnimationActive={false}
          />
        </RadialBarChart>
      </ChartContainer>

      {/* Recharts label placement is unreliable at this size — overlay instead */}
      <span
        className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums"
        style={{ color }}
      >
        {percent}%
      </span>
    </div>
  )
}

export default function SetupChecklistCard() {
  const queryClient = useQueryClient()
  const { workspaceUserId } = useAuth()
  const { canEditWorkspace } = usePermissions()
  const { data: sub } = useSubscription()
  const { data: members } = useTeamMembers()
  const { data: pendingInvites } = usePendingInvites()

  const dismiss = useMutation({
    mutationFn: dismissSetupChecklist,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscription'] }),
    onError: () => toast.error('Could not dismiss. Please try again.'),
  })

  // The owner occupies an agency_members row too, so "has teammates" means at
  // least one member who isn't the workspace owner.
  const hasTeammates = (members ?? []).some(
    (m) => m.member_user_id !== workspaceUserId,
  )

  const hasPendingInvite = (pendingInvites ?? []).length > 0

  const items = CHECKLIST_STEPS.map((step) => ({
    ...step,
    done: step.isDone({ sub, hasTeammates, hasPendingInvite }),
  }))

  const isDismissed = (sub?.onboarding_skipped_steps ?? []).length === 0

  // Owner-only, per .claude/features/03-rbac-team-roles.md: agency branding,
  // invoice signatory and team invites are all owner-exclusive, and admins are
  // view-only on workspace settings — every row would be a dead link for them.
  if (!canEditWorkspace || isDismissed) return null

  const doneCount = items.filter((i) => i.done).length
  const percent = Math.round((doneCount / items.length) * 100)
  const allDone = doneCount === items.length

  return (
    <div className="rounded-xl border bg-card">
      {/* Header — progress ring reads at a glance without stretching the card */}
      {/* px-5 matches the row padding below so the left edges align */}
      <div className="flex items-center gap-3 border-b pl-2 pr-5 py-2">
        <ProgressRing percent={percent} />

        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-lg font-semibold tracking-tight text-foreground bricolage">
            {allDone ? "You're all set" : 'Finish setting up'}
          </p>
          <p className="text-sm text-muted-foreground">
            {allDone
              ? 'Every setup step is done — dismiss this whenever you like.'
              : `${doneCount} of ${items.length} steps done`}
          </p>
        </div>

        {/* Dismissal is withheld until every step is done — a disabled X that
            looks interactive is worse than no X at all. */}
        {allDone && (
          <button
            type="button"
            onClick={() => dismiss.mutate()}
            disabled={dismiss.isPending}
            aria-label="Dismiss setup checklist"
            className="-mr-1 shrink-0 self-start rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Checklist */}
      <ul className="divide-y">
        {items.map((item) => {
          const marker = (
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full transition-colors',
                item.done
                  ? 'bg-green-600 text-white'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {item.done ? (
                <Check className="size-4" strokeWidth={3} />
              ) : (
                <item.icon className="size-4" />
              )}
            </span>
          )

          const text = (
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'block text-sm font-medium',
                  item.done
                    ? 'text-muted-foreground line-through decoration-muted-foreground/40'
                    : 'text-foreground',
                )}
              >
                {item.label}
              </span>
              <span className="block text-xs text-muted-foreground">
                {item.done ? 'Done' : item.description}
              </span>
            </span>
          )

          // Completed rows have nowhere useful to go, so they aren't links.
          return (
            <li key={item.key}>
              {item.done ? (
                <div className="flex items-center gap-3.5 px-5 py-3.5">
                  {marker}
                  {text}
                </div>
              ) : (
                <Link
                  to={item.to}
                  className="group flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-muted/40"
                >
                  {marker}
                  {text}
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
