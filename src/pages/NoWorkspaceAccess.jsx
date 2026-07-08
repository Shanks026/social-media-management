import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

const LANDSCAPE_LOGO = '/TerceroLand.svg'

/**
 * Shown when the signed-in user has no active membership in any workspace —
 * i.e. they were removed by the owner (soft delete). Their auth account is
 * untouched, so sign-in itself succeeds; this catches them post-login instead
 * of silently falling into their own dormant personal workspace and its
 * long-expired trial (a confusing, wrong-reason dead end).
 */
export default function NoWorkspaceAccess() {
  const navigate = useNavigate()
  const { signOut, removedFromWorkspace, workspaceVerified } = useAuth()

  // If the owner restores access while this tab is still sitting here (the
  // realtime agency_members listener in AuthContext picks it up live), leave
  // automatically instead of stranding them on a stale "no access" page.
  useEffect(() => {
    if (workspaceVerified && !removedFromWorkspace) {
      navigate('/dashboard', { replace: true })
    }
  }, [workspaceVerified, removedFromWorkspace, navigate])

  const handleLogout = async () => {
    // Use the context's signOut (not supabase.auth.signOut() directly) — it
    // clears auth state immediately. Calling the raw Supabase method leaves
    // `session` truthy for ~300ms (AuthContext debounces SIGNED_OUT to avoid
    // flashing on token-refresh churn), so navigating to /login in that
    // window bounces straight back to /dashboard via PublicOnlyRoute, then
    // right back here once removedFromWorkspace kicks in — the flicker.
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col w-full">
      <div className="flex items-center px-8 py-5 border-b border-border/40">
        <div
          className="h-6 w-24 bg-foreground shrink-0"
          style={{
            maskImage: `url(${LANDSCAPE_LOGO})`,
            maskRepeat: 'no-repeat',
            maskPosition: 'center left',
            maskSize: 'contain',
            WebkitMaskImage: `url(${LANDSCAPE_LOGO})`,
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center left',
            WebkitMaskSize: 'contain',
          }}
        />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center px-8 py-20">
        <div className="max-w-md space-y-6">
          <div className="text-6xl">🔒</div>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight bricolage">
              You no longer have access to this workspace
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              You've been removed from this workspace by its owner. If you think this is a
              mistake, reach out to them directly to be re-invited.
            </p>
          </div>
          <Button onClick={handleLogout} variant="outline" className="gap-2">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}
