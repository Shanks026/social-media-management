import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Lock, UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useTeamMembers } from '@/api/team'
import { useSubscription } from '@/api/useSubscription'
import { InviteDialog } from '@/pages/settings/TeamSettings'

/**
 * Onboarding's team step. It deliberately does NOT implement its own invite
 * form — it opens the same InviteDialog that Settings uses, so the owner gets
 * the full option set (link name, expiry, Member vs Admin, document access) and
 * there's no second invite UI to drift out of sync.
 */
export default function InviteTeamStep({ onInviteGenerated }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [createdCount, setCreatedCount] = useState(0)

  const { data: subscription } = useSubscription()
  const { data: members } = useTeamMembers()

  // Mirror the check useGenerateInvite performs server-side, so the button is
  // never offered when it is guaranteed to fail. null max = unlimited seats.
  const maxSeats = subscription?.max_team_members ?? null
  const seatsUsed = members?.length ?? 0
  const seatLimitReached = maxSeats != null && seatsUsed >= maxSeats

  const handleGenerated = () => {
    setCreatedCount((c) => c + 1)
    onInviteGenerated?.()
  }

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h2 className="text-2xl font-normal bricolage">Bring your team in</h2>
        <p className="text-sm text-muted-foreground">
          Share one link and they join your workspace. You choose their access
          level and what they can reach — all changeable later on the Team page.
        </p>
      </div>

      {seatLimitReached ? (
        <div className="flex items-start gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 text-sm">
          <Lock size={18} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="flex-1 space-y-0.5">
            <p className="font-semibold text-foreground">
              You&apos;ve used all {maxSeats} of your seats
            </p>
            <p className="text-muted-foreground">
              Upgrade your plan to invite more people, or continue and do this
              later.
            </p>
          </div>
          <Link
            to="/billing"
            className="mt-0.5 flex shrink-0 items-center gap-1 text-xs font-semibold text-amber-500 transition-colors hover:text-amber-400"
          >
            View plans <ArrowRight size={13} />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {createdCount > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/5 px-5 py-4 text-sm">
              <CheckCircle2 size={18} className="shrink-0 text-green-600" />
              <p className="text-foreground">
                {createdCount === 1
                  ? 'Invite link created.'
                  : `${createdCount} invite links created.`}{' '}
                <span className="text-muted-foreground">
                  Pending invites are listed on the Team page.
                </span>
              </p>
            </div>
          )}

          <div className="flex flex-col items-start gap-4 rounded-xl border border-border/60 bg-muted/10 px-6 py-8">
            <span className="text-4xl">🤝</span>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {createdCount > 0 ? 'Invite someone else' : 'Invite a teammate'}
              </p>
              <p className="text-sm text-muted-foreground">
                Set the access level and expiry, then send the link however you
                like.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="gap-2"
            >
              <UserPlus className="size-4" />
              {createdCount > 0 ? 'Create another link' : 'Create invite link'}
            </Button>
          </div>
        </div>
      )}

      <InviteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onGenerated={handleGenerated}
      />
    </div>
  )
}
