import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

export function SignupForm({ className, ...props }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const form = new FormData(e.currentTarget)
    const name = form.get('name')
    const email = form.get('email')
    const password = form.get('password')
    const confirm = form.get('confirm-password')

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    })
    setLoading(false)

    if (error) {
      setError(error.message)
    } else if (data?.session) {
      navigate('/dashboard')
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-700 dark:text-green-400 text-left">
        <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
        <span>Account created! Check your email to confirm your address before signing in.</span>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('space-y-5 text-left', className)}
      {...props}
    >
      {/* Full name */}
      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="Jane Smith"
          required
        />
      </div>

      {/* Email */}
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

      {/* Passwords */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm</Label>
          <Input
            id="confirm-password"
            name="confirm-password"
            type="password"
            required
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Use 8 or more characters with a mix of letters and numbers.
      </p>

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
        {loading ? 'Getting you started…' : 'Create account'}
      </Button>
    </form>
  )
}
