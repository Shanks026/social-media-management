import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '../src/context/AuthContext'
import LoginPage from './components/auth/login'
import SignupPage from './components/auth/signup'
import { AppShell } from './components/misc/AppShell'
import Clients from './pages/clients/Clients'
import ClientDetails from './pages/clients/ClientDetails'
import PostDetails from './pages/posts/postDetails/PostDetails'
import PublicReview from './pages/PublicReview'

function AppRoutes() {
  const { session, user } = useAuth()

  return (
    <Routes>
      <Route path="/review/:token" element={<PublicReview />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {session ? (
        <Route element={<AppShell user={user} />}>
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:clientId" element={<ClientDetails />} />
          <Route
            path="/clients/:clientId/posts/:postId"
            element={<PostDetails />}
          />
          <Route path="*" element={<Navigate to="/clients" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
