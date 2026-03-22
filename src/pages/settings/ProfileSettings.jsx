import { useState, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useSubscription } from '@/api/useSubscription'
import { PlanOverview } from '../billingAndUsage/PlanOverview'
import { plans } from '../billingAndUsage/TertiarySubscriptionTab'

// UI
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

// Icons
import {
  Mail,
  CalendarDays,
  Hash,
  Copy,
  Check,
  Trash2,
  Loader2,
  Camera,
  ImagePlus,
  AlertTriangle,
  Heart,
  Save,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ChangePasswordDialog from '@/components/settings/ChangePasswordDialog'

function extractStoragePath(publicUrl) {
  if (!publicUrl) return null
  const marker = '/post-media/'
  const idx = publicUrl.indexOf(marker)
  return idx !== -1 ? publicUrl.slice(idx + marker.length) : null
}

export default function ProfileSettings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: sub, isLoading } = useSubscription()

  const currentPlanName = sub?.plan_name?.toLowerCase() || 'ignite'
  const currentPlan =
    plans.find((p) => p.name.toLowerCase() === currentPlanName) || plans[0]

  const handleUpgradeClick = () => {
    navigate('/billing?tab=subscription&scroll=true')
  }

  // Profile fields
  const [fullName, setFullName] = useState(
    user?.user_metadata?.full_name || '',
  )
  const [avatarUrl, setAvatarUrl] = useState(
    user?.user_metadata?.avatar_url || '',
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef(null)

  // Delete
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Change Password
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)

  // Copy UID
  const [copied, setCopied] = useState(false)

  const copyUID = () => {
    navigator.clipboard.writeText(user?.id || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('post-media')
        .upload(filePath, file)
      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('post-media').getPublicUrl(filePath)

      setAvatarUrl(publicUrl)
      toast.success('Profile photo uploaded! Click Save Changes to apply.')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload photo')
    } finally {
      setIsUploading(false)
    }
  }

  const removeAvatar = (e) => {
    e.stopPropagation()
    setAvatarUrl('')
  }

  const handleSaveProfile = async () => {
    setIsSaving(true)
    try {
      const previousAvatarUrl = user?.user_metadata?.avatar_url || ''
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          avatar_url: avatarUrl,
        },
      })
      if (error) throw error

      // Delete old avatar from storage if it changed
      if (previousAvatarUrl && previousAvatarUrl !== avatarUrl) {
        const path = extractStoragePath(previousAvatarUrl)
        if (path) await supabase.storage.from('post-media').remove([path])
      }

      toast.success('Profile updated!')
    } catch {
      toast.error('Failed to update profile.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    try {
      await supabase.auth.signOut()
      navigate('/login')
    } catch {
      toast.error('Something went wrong.')
      setIsDeleting(false)
    }
  }

  const hasChanges =
    fullName !== (user?.user_metadata?.full_name || '') ||
    avatarUrl !== (user?.user_metadata?.avatar_url || '')

  return (
    <div className="w-full space-y-14">
      {/* ── Section: Avatar & Identity ── */}
      <section className="space-y-8">
        <div className="space-y-1">
          <h2 className="text-2xl font-normal tracking-tight">
            Profile
          </h2>
          <p className="text-sm text-muted-foreground font-light">
            Your personal identity and avatar.
          </p>
        </div>

        {/* Row 1: Avatar + save action */}
        <div className="flex items-start gap-6 flex-wrap">
          <div
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'group relative flex size-28 cursor-pointer flex-col items-center justify-center rounded-full border-2 border-dashed transition-all hover:bg-muted/50 shrink-0',
              avatarUrl ? 'border-primary/40' : 'border-border',
            )}
          >
            {avatarUrl ? (
              <>
                <div className="relative size-full overflow-hidden rounded-full border-2 border-border bg-background shadow-sm">
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="size-full object-cover transition-transform group-hover:scale-110"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera className="size-6 text-white" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeAvatar}
                  className="absolute right-0 top-0 z-10 rounded-full bg-destructive p-1.5 text-white shadow-lg hover:bg-destructive/90 transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground transition-colors group-hover:text-foreground">
                {isUploading ? (
                  <Loader2 className="size-5 animate-spin text-primary" />
                ) : (
                  <ImagePlus className="size-5" />
                )}
                <span className="text-xs font-medium">Photo</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={isUploading}
            />
          </div>

          {hasChanges && (
            <div className="self-end pb-0.5">
              <Button onClick={handleSaveProfile} disabled={isSaving} size="sm" className="gap-2">
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Changes
              </Button>
            </div>
          )}
        </div>

        {/* Row 2: Name & Details */}
        <div className="space-y-6 max-w-xl">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-6">
            <InfoRow
              icon={<Mail size={16} />}
              label="Email Address"
              value={user?.email || '—'}
            />
            <InfoRow
              icon={<CalendarDays size={16} />}
              label="Account Created"
              value={
                user?.created_at
                  ? format(new Date(user.created_at), 'MMMM d, yyyy')
                  : '—'
              }
            />
            <div className="flex items-start gap-4">
              <div className="mt-0.5 h-9 w-9 shrink-0 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground">
                <Hash size={16} />
              </div>
              <div className="flex-1 space-y-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  User ID
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono text-foreground/80 truncate">
                    {user?.id || '—'}
                  </code>
                  <button
                    type="button"
                    onClick={copyUID}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                  >
                    {copied ? (
                      <Check size={14} className="text-green-500" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Separator className="opacity-50" />

      {/* ── Section: Subscription ── */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-medium tracking-tight">Subscription</h2>
          <p className="text-sm text-muted-foreground font-light">
            Manage your agency&apos;s billing and feature access.
          </p>
        </div>

        {isLoading ? (
          <div className="h-36 bg-muted/30 animate-pulse rounded-2xl" />
        ) : (
          <PlanOverview
            sub={sub}
            currentPlan={currentPlan}
            onUpgradeClick={handleUpgradeClick}
          />
        )}
      </section>

      <Separator className="opacity-50" />

      {/* ── Section: Security ── */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-medium tracking-tight">Security</h2>
          <p className="text-sm text-muted-foreground font-light">
            Manage your password and authentication settings.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">Password</p>
            <p className="text-xs text-muted-foreground">
              Ensure your account is using a long, random password to stay secure.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsChangePasswordOpen(true)}
            className="gap-2"
          >
            Change Password
          </Button>
        </div>
      </section>

      <Separator className="opacity-50" />

      {/* ── Section: Danger Zone ── */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-medium text-destructive tracking-tight">
            Danger Zone
          </h2>
          <p className="text-sm text-muted-foreground font-light">
            Irreversible actions. Please proceed with caution.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">
              Delete Account
            </p>
            <p className="text-xs text-muted-foreground">
              Permanently remove your account and all associated data.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsDeleteAccountOpen(true)}
            className="gap-2"
          >
            <Trash2 size={14} />
            Delete
          </Button>
        </div>
      </section>

      {/* ── Delete Account Dialog ── */}
      <Dialog
        open={isDeleteAccountOpen}
        onOpenChange={(val) => {
          setIsDeleteAccountOpen(val)
          if (!val) setDeleteConfirmText('')
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <Heart size={28} className="text-destructive" />
            </div>
            <div className="text-center space-y-2">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                We&apos;re sad to see you go
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                It&apos;s been a wonderful journey. If you ever change your
                mind, we&apos;ll be right here &mdash; ready to welcome you
                back with open arms.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-destructive text-xs font-bold uppercase tracking-tight">
                <AlertTriangle size={14} />
                This action is irreversible
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your account, agency data, clients, posts, and all associated
                content will be permanently removed.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Type <strong className="text-foreground">DELETE</strong> to
                confirm
              </p>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="font-mono"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setIsDeleteAccountOpen(false)
                setDeleteConfirmText('')
              }}
            >
              Keep My Account
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={deleteConfirmText !== 'DELETE' || isDeleting}
              onClick={handleDeleteAccount}
            >
              {isDeleting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                'Goodbye, for now'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* ── Change Password Dialog ── */}
      <ChangePasswordDialog
        open={isChangePasswordOpen}
        onOpenChange={setIsChangePasswordOpen}
        userEmail={user?.email}
      />
    </div>
  )
}

// ─── Sub-components ───

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-4">
      <div className="mt-0.5 h-9 w-9 shrink-0 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
    </div>
  )
}
