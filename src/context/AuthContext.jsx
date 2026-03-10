import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  workspaceUserId: null,
  userRole: null,
})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [workspaceUserId, setWorkspaceUserId] = useState(null)
  const [userRole, setUserRole] = useState(null)

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
      // Fallback: treat as their own workspace (e.g. before agency_members row exists)
      setWorkspaceUserId(uid)
      setUserRole('admin')
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      resolveWorkspace(session?.user?.id ?? null).finally(() => setLoading(false))
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      resolveWorkspace(session?.user?.id ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, loading, workspaceUserId, userRole }}>
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
