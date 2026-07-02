import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  workspaceUserId: null,
  userRole: null,
  userPermissions: null,
  signOut: async () => {},
})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [workspaceUserId, setWorkspaceUserId] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [userPermissions, setUserPermissions] = useState(null)
  // Tracks the uid we've already resolved the workspace for, so repeated auth
  // events for the SAME user don't re-resolve and churn workspaceUserId.
  const resolvedUidRef = useRef(null)
  // Timer that delays clearing auth state on SIGNED_OUT, so a token-refresh
  // SIGNED_OUT → SIGNED_IN sequence doesn't flash the loading screen.
  const signOutTimerRef = useRef(null)

  const clearAuthState = useCallback(() => {
    setSession(null)
    setUser(null)
    setWorkspaceUserId(null)
    setUserRole(null)
    setUserPermissions(null)
  }, [])

  // Update workspace state only when a value actually changed. resolveWorkspace
  // runs repeatedly (initial getSession, auth events, token refreshes) and
  // always builds a fresh `perms` object — writing it every time churns the
  // context value and re-renders every consumer for no reason.
  const applyWorkspace = useCallback((wid, role, perms) => {
    setWorkspaceUserId((prev) => (prev === wid ? prev : wid))
    setUserRole((prev) => (prev === role ? prev : role))
    setUserPermissions((prev) =>
      JSON.stringify(prev) === JSON.stringify(perms) ? prev : perms
    )
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    // Cancel the deferred clear that the SIGNED_OUT event just scheduled,
    // then clear state immediately so redirect to /login is instant.
    if (signOutTimerRef.current) {
      clearTimeout(signOutTimerRef.current)
      signOutTimerRef.current = null
    }
    resolvedUidRef.current = null
    clearAuthState()
  }, [clearAuthState])

  const resolveWorkspace = useCallback(async (uid) => {
    if (!uid) {
      setWorkspaceUserId(null)
      setUserRole(null)
      return
    }

    const { data, error } = await supabase
      .from('agency_members')
      .select('agency_user_id, system_role, permissions')
      .eq('member_user_id', uid)
      .eq('is_active', true)
      .maybeSingle()

    // Transient failure (network blip, token mid-refresh): do NOT mis-resolve.
    // Keep whatever workspace state we already have and let a later event retry.
    // Falling through to the owner branch here would wrongly treat a member as
    // their own workspace → no subscription row → forced sign-out.
    if (error) {
      console.error('resolveWorkspace: agency_members lookup failed', error)
      return
    }

    if (data) {
      const ws = { wid: data.agency_user_id, role: data.system_role, perms: data.permissions ?? { documents: 'view' } }
      try { sessionStorage.setItem(`wsp_${uid}`, JSON.stringify(ws)) } catch { /* sessionStorage unavailable */ }
      applyWorkspace(ws.wid, ws.role, ws.perms)
    } else {
      // No membership row at all → genuine owner whose self-row isn't visible yet
      // (first-signup race). Owners resolve to their own uid.
      const ws = { wid: uid, role: 'owner', perms: { documents: 'manage' } }
      try { sessionStorage.setItem(`wsp_${uid}`, JSON.stringify(ws)) } catch { /* sessionStorage unavailable */ }
      applyWorkspace(ws.wid, ws.role, ws.perms)
    }
  }, [applyWorkspace])

  const refreshWorkspace = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    await resolveWorkspace(currentUser?.id ?? null)
  }, [resolveWorkspace])

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session)
        setUser(session?.user ?? null)
        const uid = session?.user?.id ?? null
        resolvedUidRef.current = uid
        return resolveWorkspace(uid)
      })
      .finally(() => setLoading(false))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null

      if (event === 'SIGNED_OUT') {
        // Supabase emits a transient SIGNED_OUT while rotating the refresh token.
        // Clearing state here sets `session` to null, which flips the route guard
        // and unmounts/remounts the entire app tree — the post-login "flash".
        // Defer briefly, then clear ONLY if the session is genuinely gone; a
        // token refresh will have already restored it. A user-initiated logout
        // goes through signOut() below, which clears immediately.
        if (signOutTimerRef.current) clearTimeout(signOutTimerRef.current)
        signOutTimerRef.current = setTimeout(async () => {
          signOutTimerRef.current = null
          const { data } = await supabase.auth.getSession()
          if (!data.session) {
            resolvedUidRef.current = null
            clearAuthState()
          }
        }, 300)
        return
      }

      // Any non-SIGNED_OUT event means the session is live — cancel a pending clear.
      if (signOutTimerRef.current) {
        clearTimeout(signOutTimerRef.current)
        signOutTimerRef.current = null
      }

      // Keep session/user fresh on every event (token refreshes, user updates).
      setSession(session)
      setUser(session?.user ?? null)

      if (uid === resolvedUidRef.current) return
      resolvedUidRef.current = uid

      // Immediately restore cached workspace so TrialGuardedShell can mount
      // AppShell without waiting for the async agency_members DB lookup.
      // The DB call below still runs to verify/update role or permissions changes.
      try {
        const raw = sessionStorage.getItem(`wsp_${uid}`)
        if (raw) {
          const c = JSON.parse(raw)
          applyWorkspace(c.wid, c.role, c.perms)
        }
      } catch { /* ignore malformed cache */ }

      // Defer the DB read out of the auth callback — calling supabase inside
      // onAuthStateChange can re-enter the auth lock and stall/refire events.
      setTimeout(() => resolveWorkspace(uid), 0)
    })

    return () => {
      subscription.unsubscribe()
      if (signOutTimerRef.current) clearTimeout(signOutTimerRef.current)
    }
    // Mount-once: sets up the single auth listener. The referenced callbacks are
    // stable (useCallback), so omitting them here does not cause staleness.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When the current user's own agency_members row is updated by the owner
  // (role change, permission change), refresh workspace so capabilities update
  // immediately without requiring a page reload.
  useEffect(() => {
    const uid = user?.id
    if (!uid) return

    const channel = supabase
      .channel(`my-member-row:${uid}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agency_members',
          filter: `member_user_id=eq.${uid}`,
        },
        () => refreshWorkspace(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, refreshWorkspace])

  const value = useMemo(
    () => ({ user, session, loading, workspaceUserId, userRole, userPermissions, refreshWorkspace, signOut }),
    [user, session, loading, workspaceUserId, userRole, userPermissions, refreshWorkspace, signOut]
  )

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
