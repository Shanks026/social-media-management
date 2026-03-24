import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useSubscription } from '@/api/useSubscription'
import { Button } from '@/components/ui/button'
import { LogOut, ArrowLeft } from 'lucide-react'

const APP_NAME = 'Tercero'
const LANDSCAPE_LOGO = '/TerceroLand.svg'

export default function NotFound() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { data: sub } = useSubscription()

  const agencyLogo = sub?.logo_url
  const agencyName =
    sub?.agency_name && sub.agency_name !== APP_NAME ? sub.agency_name : null

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col w-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-border/40">
        <div className="flex items-center gap-4">
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
          {agencyLogo && (
            <>
              <div className="h-5 w-px bg-border" />
              <img
                src={agencyLogo}
                alt={agencyName || 'Agency'}
                className="h-7 w-7 rounded-md object-cover"
              />
            </>
          )}
        </div>
        {session && (
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </button>
        )}
      </div>

      {/* Hero section */}
      <div className="flex flex-col items-center justify-center text-center px-8 py-20 min-h-[calc(100vh-65px)]">
        <div className="max-w-lg space-y-6">
          <p className="text-8xl font-semibold tracking-tight text-muted-foreground/30">
            404
          </p>

          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight">
              Page not found.
              <br />
              <span className="font-normal text-muted-foreground">
                Let's get you back on track.
              </span>
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              The page you're looking for doesn't exist or may have been moved.
            </p>
          </div>

          <Button
            onClick={() => navigate(session ? '/dashboard' : '/login')}
            className="gap-2 px-6"
          >
            <ArrowLeft className="h-4 w-4" />
            {session ? 'Back to Dashboard' : 'Back to Login'}
          </Button>
        </div>
      </div>
    </div>
  )
}
