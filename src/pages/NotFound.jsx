import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function NotFound() {
  const navigate = useNavigate()
  const { session } = useAuth()

  return (
    <div className="min-h-screen bg-background flex flex-col w-full">
      {/* Hero section */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-20">
        <div className="max-w-lg space-y-6">
          <p className="text-8xl font-semibold tracking-tight text-muted-foreground/30 bricolage">
            404
          </p>

          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight bricolage">
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

      {/* Bottom mark */}
      <div className="flex justify-center pb-10">
        <div
          className="h-6 w-24 bg-foreground/70"
          style={{
            maskImage: 'url(/TerceroLand.svg)',
            maskRepeat: 'no-repeat',
            maskPosition: 'center',
            maskSize: 'contain',
            WebkitMaskImage: 'url(/TerceroLand.svg)',
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            WebkitMaskSize: 'contain',
          }}
        />
      </div>
    </div>
  )
}
