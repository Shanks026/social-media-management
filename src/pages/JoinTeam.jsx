import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { fetchInviteByToken, joinTeam } from '@/api/team'
import { SYSTEM_ROLE_PALETTE, AGENCY_ROLE_GROUPS } from '@/lib/team-roles'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, AlertCircle, Building2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const schema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().min(1, 'Email is required').email({ message: 'Enter a valid email address' }),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export default function JoinTeam() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { refreshWorkspace } = useAuth()

  const [invite, setInvite] = useState(null)
  const [tokenError, setTokenError] = useState(null)
  const [tokenLoading, setTokenLoading] = useState(true)
  const [submitError, setSubmitError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [functionalRole, setFunctionalRole] = useState('')
  const [customRole, setCustomRole] = useState('')

  useEffect(() => {
    let cancelled = false
    setTokenLoading(true)
    fetchInviteByToken(token)
      .then((data) => {
        if (cancelled) return
        if (!data?.valid) {
          setTokenError(data?.error || 'This invite link is invalid or has expired.')
        } else {
          setInvite(data)
        }
      })
      .catch(() => {
        if (!cancelled) setTokenError('This invite link is invalid or has expired.')
      })
      .finally(() => {
        if (!cancelled) setTokenLoading(false)
      })
    return () => { cancelled = true }
  }, [token])

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '', confirmPassword: '' },
  })

  async function onSubmit(values) {
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            invite_token: token,
            first_name: values.firstName,
            last_name: values.lastName,
            full_name: `${values.firstName} ${values.lastName}`.trim(),
          },
        },
      })

      if (signUpError) throw signUpError

      if (!signUpData.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        })
        if (signInError) throw signInError
      }

      const resolvedRole = functionalRole === '__custom__' ? customRole.trim() || null : functionalRole || null
      await joinTeam({ token, firstName: values.firstName, lastName: values.lastName, functional_role: resolvedRole })
      await refreshWorkspace()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (tokenLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
            <AlertCircle className="size-7 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-normal tracking-tight">Invite link unavailable</h1>
            <p className="text-sm text-muted-foreground font-normal">{tokenError}</p>
            <p className="text-xs text-muted-foreground">
              Ask your workspace owner to generate a new invite link.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const sysRolePalette = SYSTEM_ROLE_PALETTE[invite?.system_role] ?? SYSTEM_ROLE_PALETTE.member

  return (
    <div className="w-full min-h-screen bg-background">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="mx-auto max-w-4xl px-6 py-10 space-y-14 pb-32">

          {/* ── Title ── */}
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <img src="/TerceroLand.svg" alt="Tercero" className="h-6 object-contain shrink-0" />

              {invite?.logo_horizontal_url ? (
                <img src={invite.logo_horizontal_url} alt={invite.agency_name} className="h-12 object-contain shrink-0" />
              ) : invite?.logo_url ? (
                <div className="flex items-center gap-3">
                  {invite?.agency_name && (
                    <span className="text-sm font-medium text-muted-foreground">{invite.agency_name}</span>
                  )}
                  <img src={invite.logo_url} alt={invite.agency_name} className="h-12 w-12 object-cover rounded-xl shrink-0" />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {invite?.agency_name && (
                    <span className="text-sm font-medium text-muted-foreground">{invite.agency_name}</span>
                  )}
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                    <Building2 className="size-6 text-primary" />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-normal tracking-tight bricolage">You&apos;re invited</h1>
              <p className="text-muted-foreground font-normal">
                Create your account to join{' '}
                {invite?.agency_name ? `the ${invite.agency_name} workspace` : 'the team'}.
              </p>

              {/* System role display */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-sm text-muted-foreground">Joining as</span>
                <Badge className={sysRolePalette.badge}>
                  {sysRolePalette.label}
                </Badge>
              </div>
            </div>
          </div>

          {/* ── Account Details ── */}
          <section className="space-y-8">
            <h2 className="text-2xl font-normal bricolage">Account Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>First name <span className="text-destructive">*</span></Label>
                <Input {...register('firstName')} placeholder="Jane" />
                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Last name <span className="text-destructive">*</span></Label>
                <Input {...register('lastName')} placeholder="Smith" />
                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email address <span className="text-destructive">*</span></Label>
              <Input type="email" {...register('email')} placeholder="jane@example.com" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Password <span className="text-destructive">*</span></Label>
                <Input type="password" {...register('password')} placeholder="At least 8 characters" />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Confirm password <span className="text-destructive">*</span></Label>
                <Input type="password" {...register('confirmPassword')} placeholder="Repeat your password" />
                {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
              </div>
            </div>
          </section>

          {/* ── Your Role ── */}
          <section className="space-y-8">
            <h2 className="text-2xl font-normal bricolage">Your Role</h2>
            <div className="space-y-2">
              <Label>Job title <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Select value={functionalRole} onValueChange={setFunctionalRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  {AGENCY_ROLE_GROUPS.map((group) => (
                    <SelectGroup key={group.label}>
                      <SelectLabel>{group.label}</SelectLabel>
                      {group.roles.map((role) => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                  <SelectGroup>
                    <SelectLabel>Other</SelectLabel>
                    <SelectItem value="__custom__">Custom…</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              {functionalRole === '__custom__' && (
                <Input
                  placeholder="e.g. Video Producer, Paralegal…"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  className="mt-2"
                />
              )}
              <p className="text-xs text-muted-foreground">This is cosmetic — it shows on your team profile and can be changed later.</p>
            </div>
          </section>

          {submitError && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-6">
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Create account &amp; join
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
