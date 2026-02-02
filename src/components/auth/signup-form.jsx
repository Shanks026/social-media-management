import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom' // 1. Added useNavigate
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function SignupForm({ className, ...props }) {
  const navigate = useNavigate() // 2. Initialize navigate
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

    // 3. Destructure data to check for the session
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    })

    setLoading(false)

    if (error) {
      setError(error.message)
    } else if (data?.session) {
      // 4. Redirect to clients on successful signup
      navigate('/clients')
    } else {
      // If email confirmation is ON, session will be null.
      // You might want to show a "Check your email" message here.
      setError('Success! Please check your email to confirm your account.')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('flex flex-col gap-6', className)}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Fill in the form below to create your account
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="name">Full Name</FieldLabel>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="John Doe"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="m@example.com"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input id="password" name="password" type="password" required />
          <FieldDescription>
            Must be at least 8 characters long.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
          <Input
            id="confirm-password"
            name="confirm-password"
            type="password"
            required
          />
          <FieldDescription>Please confirm your password.</FieldDescription>
        </Field>
      </FieldGroup>

      {/* Success/Error message styling */}
      {error && (
        <p
          className={cn(
            'text-sm',
            error.includes('Success') ? 'text-green-600' : 'text-red-500',
          )}
        >
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Account'}
      </Button>
    </form>
  )
}
