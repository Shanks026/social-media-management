import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useSubscription } from '@/api/useSubscription'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, PenLine, Save, X, ArrowRight } from 'lucide-react'

function extractStoragePath(publicUrl) {
  if (!publicUrl) return null
  const marker = '/post-media/'
  const idx = publicUrl.indexOf(marker)
  return idx !== -1 ? publicUrl.slice(idx + marker.length) : null
}

export default function InvoiceSettings() {
  const { workspaceUserId } = useAuth()
  const { data: subscription, isLoading } = useSubscription()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const signatureInputRef = useRef(null)
  const hasInitialized = useRef(false)

  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingSignature, setIsUploadingSignature] = useState(false)

  const [signatoryName, setSignatoryName] = useState('')
  const [signatoryDesignation, setSignatoryDesignation] = useState('')
  const [signatureUrl, setSignatureUrl] = useState(null)

  useEffect(() => {
    if (subscription && !hasInitialized.current) {
      hasInitialized.current = true
      setSignatoryName(subscription.signatory_name || '')
      setSignatoryDesignation(subscription.signatory_designation || '')
      setSignatureUrl(subscription.signature_url || null)
    }
  }, [subscription])

  const handleSignatureUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setIsUploadingSignature(true)
      const fileExt = file.name.split('.').pop()
      const filePath = `signatures/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('post-media')
        .upload(filePath, file)
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('post-media')
        .getPublicUrl(filePath)

      if (signatureUrl) {
        const oldPath = extractStoragePath(signatureUrl)
        if (oldPath) await supabase.storage.from('post-media').remove([oldPath])
      }

      setSignatureUrl(publicUrl)
      toast.success('Signature uploaded. Click Save to apply.')
    } catch (err) {
      console.error(err)
      toast.error('Failed to upload signature')
    } finally {
      setIsUploadingSignature(false)
      if (signatureInputRef.current) signatureInputRef.current.value = ''
    }
  }

  const removeSignature = async () => {
    if (signatureUrl) {
      const path = extractStoragePath(signatureUrl)
      if (path) await supabase.storage.from('post-media').remove([path])
    }
    setSignatureUrl(null)
    if (signatureInputRef.current) signatureInputRef.current.value = ''
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('agency_subscriptions')
        .update({
          signatory_name: signatoryName || null,
          signatory_designation: signatoryDesignation || null,
          signature_url: signatureUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', workspaceUserId)

      if (error) throw error

      await queryClient.invalidateQueries({ queryKey: ['subscription'] })
      toast.success('Invoice settings saved')
    } catch (err) {
      console.error(err)
      toast.error('Failed to save invoice settings')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Where agency details come from */}
      <div className="flex items-start gap-4 rounded-xl border border-border bg-muted/20 px-5 py-4 text-sm">
        <div className="flex-1 space-y-0.5">
          <p className="font-medium text-foreground">
            Agency name, address, email & website come from your agency profile
          </p>
          <p className="text-muted-foreground">
            These appear automatically on every invoice. Update them in the Agency tab.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/settings?tab=agency')}
          className="shrink-0 mt-0.5 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Agency profile <ArrowRight className="size-3" />
        </button>
      </div>

      {/* Signatory */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h3 className="text-lg font-medium">Signatory</h3>
          <p className="text-sm text-muted-foreground">
            The person whose name and signature appear on invoices.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input
              value={signatoryName}
              onChange={(e) => setSignatoryName(e.target.value)}
              placeholder="e.g. Chris Austin A"
            />
          </div>
          <div className="space-y-2">
            <Label>Designation</Label>
            <Input
              value={signatoryDesignation}
              onChange={(e) => setSignatoryDesignation(e.target.value)}
              placeholder="e.g. Founder"
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label>Signature</Label>
          {signatureUrl ? (
            <div className="relative inline-block">
              <div className="rounded-lg border border-border bg-muted/20 p-4 pr-10">
                <img
                  src={signatureUrl}
                  alt="Signature preview"
                  className="h-16 max-w-55 object-contain"
                />
              </div>
              <button
                type="button"
                onClick={removeSignature}
                className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive p-1 text-white shadow"
              >
                <X className="size-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => signatureInputRef.current?.click()}
              disabled={isUploadingSignature}
              className={cn(
                'flex items-center gap-3 rounded-lg border-2 border-dashed border-border px-5 py-4 text-sm text-muted-foreground',
                'hover:border-primary/40 hover:text-foreground transition-colors cursor-pointer w-fit',
              )}
            >
              {isUploadingSignature
                ? <Loader2 className="size-4 animate-spin" />
                : <PenLine className="size-4" />
              }
              {isUploadingSignature ? 'Uploading...' : 'Upload signature image'}
            </button>
          )}
          <input
            ref={signatureInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleSignatureUpload}
            disabled={isUploadingSignature}
          />
          <p className="text-xs text-muted-foreground">
            PNG with transparent background works best.
          </p>
        </div>
      </section>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving
            ? <Loader2 className="size-4 animate-spin" />
            : <Save className="size-4" />
          }
          Save Invoice Settings
        </Button>
      </div>
    </div>
  )
}
