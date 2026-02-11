import { cn } from '@/lib/utils'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useNavigate } from 'react-router-dom'

export function LoginForm({ className, ...props }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const email = form.get('email')
    const password = form.get('password')

    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setLoading(false)

    if (error) {
      setError(error.message)
    } else if (data?.session) {
      navigate('/clients')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('flex flex-col gap-8', className)}
      {...props}
    >
      <div className="flex flex-col gap-3 text-center md:text-left">
        {/* Google uses 'Sign in' and 'Use your account' phrasing */}
        <h1 className="text-3xl font-medium tracking-tight text-foreground">
          Sign in
        </h1>
        <p className="text-[15px] text-muted-foreground leading-relaxed">
          to continue to your Workspace
        </p>
      </div>

      <div className="grid gap-5">
        <Field className="space-y-2">
          <FieldLabel htmlFor="email" className="text-sm font-medium ml-1">
            Email
          </FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="m@example.com"
            required
            className="h-12 rounded-full border-input bg-background px-4 focus-visible:ring-1"
          />
        </Field>

        <Field className="space-y-2">
          <div className="flex items-center justify-between ml-1">
            <FieldLabel
              htmlFor="password"
              title="Password"
              className="text-sm font-medium"
            >
              Password
            </FieldLabel>
            <a
              href="#"
              className="text-sm font-medium text-primary hover:underline underline-offset-4"
            >
              Forgot password?
            </a>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
            className="h-12 rounded-full border-input bg-background px-4 focus-visible:ring-1"
          />
        </Field>
      </div>

      {error && (
        <div className="bg-destructive/10 p-3 rounded-lg border border-destructive/20">
          <p className="text-sm text-destructive text-center">{error}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 pt-2">
        <Button
          type="submit"
          className="h-11 w-full rounded-full font-medium text-[15px] transition-all"
          disabled={loading}
        >
          {loading ? 'Processing...' : 'Login'}
        </Button>
      </div>
    </form>
  )
}
