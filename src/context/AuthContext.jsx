import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  workspaceUserId: null,
  userRole: null,
  signOut: async () => {},
})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [workspaceUserId, setWorkspaceUserId] = useState(null)
  const [userRole, setUserRole] = useState(null)

  const clearAuthState = useCallback(() => {
    setSession(null)
    setUser(null)
    setWorkspaceUserId(null)
    setUserRole(null)
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    clearAuthState()
  }, [clearAuthState])

  const resolveWorkspace = async (uid) => {
    if (!uid) {
      setWorkspaceUserId(null)
      setUserRole(null)
      return
    }

    const { data } = await supabase
      .from('agency_members')
      .select('agency_user_id, system_role')
      .eq('member_user_id', uid)
      .eq('is_active', true)
      .single()

    if (data) {
      setWorkspaceUserId(data.agency_user_id)
      setUserRole(data.system_role)
    } else {
      // Workspace owner: no agency_members row yet
      setWorkspaceUserId(uid)
      setUserRole('admin')
    }
  }

  const refreshWorkspace = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    await resolveWorkspace(currentUser?.id ?? null)
  }

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session)
        setUser(session?.user ?? null)
        return resolveWorkspace(session?.user?.id ?? null)
      })
      .finally(() => setLoading(false))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clearAuthState()
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(session)
        setUser(session?.user ?? null)
        resolveWorkspace(session?.user?.id ?? null)
      } else {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user?.id) resolveWorkspace(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, loading, workspaceUserId, userRole, refreshWorkspace, signOut }}>
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
