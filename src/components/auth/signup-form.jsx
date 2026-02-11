import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function SignupForm({ className, ...props }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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
      navigate('/clients')
    } else {
      setError('Success! Please check your email to confirm your account.')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('flex flex-col gap-6', className)}
      {...props}
    >
      <div className="flex flex-col gap-2 text-center md:text-left">
        <h1 className="text-3xl font-medium tracking-tight text-foreground">
          Create account
        </h1>
        <p className="text-[15px] text-muted-foreground leading-relaxed">
          to start managing your agency
        </p>
      </div>

      <div className="grid gap-4">
        {/* Name and Email remain vertical for readability at this width */}
        <Field className="space-y-1.5">
          <FieldLabel htmlFor="name" className="text-sm font-medium ml-4">
            Full Name
          </FieldLabel>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="John Doe"
            required
            className="h-12 rounded-full border-input bg-background px-6 focus-visible:ring-1"
          />
        </Field>

        <Field className="space-y-1.5">
          <FieldLabel htmlFor="email" className="text-sm font-medium ml-4">
            Email
          </FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="m@example.com"
            required
            className="h-12 rounded-full border-input bg-background px-6 focus-visible:ring-1"
          />
        </Field>

        {/* Realignment: Side-by-side grid for passwords to save vertical space */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field className="space-y-1.5">
            <FieldLabel
              htmlFor="password"
              title="Password"
              className="text-sm font-medium ml-4"
            >
              Password
            </FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              required
              className="h-12 rounded-full border-input bg-background px-6 focus-visible:ring-1"
            />
          </Field>

          <Field className="space-y-1.5">
            <FieldLabel
              htmlFor="confirm-password"
              title="Confirm Password"
              className="text-sm font-medium ml-4"
            >
              Confirm
            </FieldLabel>
            <Input
              id="confirm-password"
              name="confirm-password"
              type="password"
              required
              className="h-12 rounded-full border-input bg-background px-6 focus-visible:ring-1"
            />
          </Field>
        </div>

        <FieldDescription className="text-[12px] ml-4 text-muted-foreground/80 -mt-1">
          Use 8 or more characters with a mix of letters and numbers.
        </FieldDescription>
      </div>

      {error && (
        <div
          className={cn(
            'p-3 rounded-2xl border text-sm text-center',
            error.includes('Success')
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-destructive/10 border-destructive/20 text-destructive',
          )}
        >
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 pt-2">
        <Button
          type="submit"
          className="h-12 w-full rounded-full font-medium text-[15px] shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create account'}
        </Button>
      </div>
    </form>
  )
}
