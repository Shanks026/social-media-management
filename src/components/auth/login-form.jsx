import { cn } from '@/lib/utils'
import { useState } from 'react'
import { signInWithPassword } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, AlertCircle } from 'lucide-react'
import ForgotPasswordDialog from './ForgotPasswordDialog'

export function LoginForm({ className, client, onSuccess, ...props }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isForgotOpen, setIsForgotOpen] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const email = form.get('email')
    const password = form.get('password')

    setLoading(true)
    let session
    try {
      session = await signInWithPassword({ email, password }, client)
    } catch (err) {
      setError(err.message)
      return
    } finally {
      setLoading(false)
    }

    if (session) {
      // No navigate() here on purpose. signInWithPassword resolves before
      // AuthContext's onAuthStateChange listener has committed setSession, so
      // navigating in this tick lands on a router that still has only the
      // unauthenticated routes mounted — /dashboard doesn't exist yet, the `*`
      // catch-all matches, and it redirects straight back to /login. That is
      // what made signing in take two attempts.
      //
      // PublicOnlyRoute already redirects to /dashboard the moment `session`
      // lands, so letting the route react is both correct and race-free.
      if (onSuccess) onSuccess(session)
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className={cn('space-y-5 text-left', className)}
        {...props}
      >
        {/* Fields */}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="m@example.com"
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              onClick={() => setIsForgotOpen(true)}
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
            >
              Forgot password?
            </button>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit */}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading ? 'Diving right in…' : 'Login'}
        </Button>
      </form>

      <ForgotPasswordDialog
        open={isForgotOpen}
        onOpenChange={setIsForgotOpen}
      />
    </>
  )
}
