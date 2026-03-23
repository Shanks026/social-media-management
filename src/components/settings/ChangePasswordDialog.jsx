import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Mail,
  Shield,
  Lock,
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'

const STEPS = {
  SEND_OTP: 'send_otp',
  VERIFY_OTP: 'verify_otp',
  NEW_PASSWORD: 'new_password',
}

export default function ChangePasswordDialog({
  open,
  onOpenChange,
  userEmail,
}) {
  const [step, setStep] = useState(STEPS.SEND_OTP)
  const [isBusy, setIsBusy] = useState(false)

  // Step 2
  const [otp, setOtp] = useState('')

  // Step 3
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Warn on close
  const [showCloseWarning, setShowCloseWarning] = useState(false)

  const isInProgress = step !== STEPS.SEND_OTP

  const resetAll = () => {
    setStep(STEPS.SEND_OTP)
    setOtp('')
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowOld(false)
    setShowNew(false)
    setShowConfirm(false)
    setIsBusy(false)
  }

  const handleOpenChange = (val) => {
    if (!val && isInProgress) {
      // User is trying to close mid-flow — show warning
      setShowCloseWarning(true)
      return
    }
    if (!val) resetAll()
    onOpenChange(val)
  }

  const handleForceClose = () => {
    setShowCloseWarning(false)
    resetAll()
    onOpenChange(false)
  }

  // ── Step 1: Send OTP ──
  const handleSendOtp = async () => {
    setIsBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: userEmail,
        options: { shouldCreateUser: false },
      })
      if (error) throw error
      toast.success('OTP sent to your email!')
      setStep(STEPS.VERIFY_OTP)
    } catch (err) {
      toast.error(err.message || 'Failed to send OTP.')
    } finally {
      setIsBusy(false)
    }
  }

  // ── Step 2: Verify OTP ──
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter the 6-digit code.')
      return
    }
    setIsBusy(true)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: userEmail,
        token: otp,
        type: 'email',
      })
      if (error) throw error
      toast.success('Identity verified!')
      setStep(STEPS.NEW_PASSWORD)
    } catch (err) {
      toast.error(err.message || 'Invalid or expired OTP.')
    } finally {
      setIsBusy(false)
    }
  }

  // ── Step 3: Save new password ──
  const handleSavePassword = async () => {
    if (!oldPassword) {
      toast.error('Please enter your old password.')
      return
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }
    setIsBusy(true)
    try {
      // 1. Verify old password first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: oldPassword,
      })

      if (signInError) {
        throw new Error('Incorrect old password.')
      }

      const { data: userData, error } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (error) throw error

      toast.success('Password updated successfully! Logging you out...')

      // Get fresh session to ensure the edge function succeeds
      const {
        data: { session },
      } = await supabase.auth.getSession()

      // Send notification email
      if (userData?.user?.email && session?.access_token) {
        await supabase.functions.invoke('send-password-update-email', {
          body: { email: userData.user.email, type: 'change' },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })
      }

      // Auto logout
      await supabase.auth.signOut()

      resetAll()
      onOpenChange(false)
    } catch (err) {
      toast.error(err.message || 'Failed to update password.')
    } finally {
      setIsBusy(false)
    }
  }

  // ── Step content ──
  const stepContent = {
    [STEPS.SEND_OTP]: {
      icon: <Shield className="size-6 text-primary" />,
      title: 'Change Password',
      description:
        "We'll send a one-time code to your email address to verify your identity before changing your password.",
      body: (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <Mail className="size-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-foreground truncate">
            {userEmail}
          </span>
        </div>
      ),
      footer: (
        <Button
          className="w-full gap-2"
          onClick={handleSendOtp}
          disabled={isBusy}
        >
          {isBusy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowRight className="size-4" />
          )}
          Send Verification Code
        </Button>
      ),
    },
    [STEPS.VERIFY_OTP]: {
      icon: <Mail className="size-6 text-primary" />,
      title: 'Enter Verification Code',
      description: `Check your inbox at ${userEmail} and enter the 6-digit code below.`,
      body: (
        <div className="space-y-4">
          <Label>One-Time Code</Label>
          <Input
            value={otp}
            onChange={(e) =>
              setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
            }
            placeholder="000000"
            className="text-center text-xl tracking-[0.5em] font-mono"
            maxLength={6}
            inputMode="numeric"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Didn&apos;t receive it?{' '}
            <button
              type="button"
              className="text-primary hover:underline underline-offset-2 transition-colors"
              onClick={handleSendOtp}
              disabled={isBusy}
            >
              Resend
            </button>
          </p>
        </div>
      ),
      footer: (
        <Button
          className="w-full gap-2"
          onClick={handleVerifyOtp}
          disabled={isBusy || otp.length !== 6}
        >
          {isBusy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          Verify Code
        </Button>
      ),
    },
    [STEPS.NEW_PASSWORD]: {
      icon: <Lock className="size-6 text-primary" />,
      title: 'Set New Password',
      description:
        'Choose a strong new password. It must be at least 8 characters. Please note that you will be logged out of your account once the password is changed successfully.',
      body: (
        <div className="space-y-6">
          <div className="space-y-3">
            <Label>Old Password</Label>
            <div className="relative">
              <Input
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Current password"
                autoFocus
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowOld((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showOld ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
          <div className="space-y-3">
            <Label>New Password</Label>
            <div className="relative">
              <Input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showNew ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
          <div className="space-y-3">
            <Label>Confirm New Password</Label>
            <div className="relative">
              <Input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirm ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      ),
      footer: (
        <Button
          className="w-full gap-2"
          onClick={handleSavePassword}
          disabled={isBusy || !oldPassword || !newPassword || !confirmPassword}
        >
          {isBusy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Lock className="size-4" />
          )}
          Update Password
        </Button>
      ),
    },
  }

  const current = stepContent[step]

  // Step indicator
  const stepNumber = {
    [STEPS.SEND_OTP]: 1,
    [STEPS.VERIFY_OTP]: 2,
    [STEPS.NEW_PASSWORD]: 3,
  }[step]

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg p-8">
          <DialogHeader className="space-y-2">
            {/* Step pip + icon */}
            <div className="flex flex-col items-start gap-8">
              {/* Step dots */}
              <div className="flex gap-1.5">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      n === stepNumber
                        ? 'w-5 bg-primary'
                        : n < stepNumber
                          ? 'w-2 bg-primary/40'
                          : 'w-2 bg-border'
                    }`}
                  />
                ))}
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 py-4">
                {current.icon}
              </div>
            </div>

            <div className="space-y-1.5">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {current.title}
              </DialogTitle>
              <DialogDescription className="text-sm font-normal leading-relaxed">
                {current.description}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="">{current.body}</div>

          <DialogFooter className="flex-col gap-2 sm:flex-col pt-2">
            {current.footer}
            {isInProgress && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => setShowCloseWarning(true)}
              >
                Cancel
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close mid-session warning */}
      <AlertDialog open={showCloseWarning} onOpenChange={setShowCloseWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Password Change?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;re in the middle of changing your password. If you close
              now, your progress will not be saved and you&apos;ll need to start
              over.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Going</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceClose}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
