import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { CalendarIcon, Upload, FileText, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { useClients } from '@/api/clients'
import {
  useCreateProposal,
  useUpdateProposal,
  uploadProposalFile,
  ProposalLimitError,
} from '@/api/proposals'
import { resolveWorkspace } from '@/lib/workspace'
import { formatFileSize } from '@/lib/helper'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// ─── Zod schema ───────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

const schema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    client_type: z.enum(['client', 'prospect']),
    client_id: z.string().nullable().optional(),
    prospect_name: z.string().nullable().optional(),
    prospect_email: z
      .string()
      .nullable()
      .optional()
      .refine(
        (v) => !v || v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        'Invalid email address',
      ),
    valid_until: z.date().nullable().optional(),
    total_value: z
      .union([z.string(), z.number()])
      .nullable()
      .optional()
      .transform((v) => (v === '' || v === null || v === undefined ? null : parseFloat(v)))
      .refine((v) => v === null || (!isNaN(v) && v >= 0), 'Must be a positive number'),
  })
  .superRefine((data, ctx) => {
    if (data.client_type === 'client' && !data.client_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please select a client',
        path: ['client_id'],
      })
    }
    if (data.client_type === 'prospect' && !data.prospect_name?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Prospect name is required',
        path: ['prospect_name'],
      })
    }
  })

// ─── Component ────────────────────────────────────────────────────────────────

export function UploadProposalDialog({ open, onOpenChange, clientId = null, onUpgradeNeeded }) {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const { data: clientData } = useClients()
  const clients = useMemo(() => clientData?.realClients || [], [clientData])

  const createProposal = useCreateProposal()
  const updateProposal = useUpdateProposal()

  const [selectedFile, setSelectedFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(null) // null | 'uploading' | 'done'

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      client_type: 'client',
      client_id: clientId || '',
      prospect_name: '',
      prospect_email: '',
      valid_until: null,
      total_value: '',
    },
  })

  const {
    register,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = form

  const clientType = watch('client_type')

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      reset({
        title: '',
        client_type: 'client',
        client_id: clientId || '',
        prospect_name: '',
        prospect_email: '',
        valid_until: null,
        total_value: '',
      })
      setSelectedFile(null)
      setFileError(null)
      setUploadProgress(null)
    }
  }, [open, reset, clientId])

  // ─── File selection ────────────────────────────────────────────────────────

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    validateAndSetFile(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) validateAndSetFile(file)
  }

  function validateAndSetFile(file) {
    setFileError(null)
    if (file.type !== 'application/pdf') {
      setFileError('Only PDF files are accepted')
      setSelectedFile(null)
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError('File must be 20 MB or smaller')
      setSelectedFile(null)
      return
    }
    setSelectedFile(file)
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function onSubmit(values) {
    if (!selectedFile) {
      setFileError('Please select a PDF file to upload')
      return
    }

    try {
      // 1. Create the proposal record
      const proposal = await createProposal.mutateAsync({
        proposal_type: 'uploaded',
        title: values.title,
        client_id: values.client_type === 'client' ? (values.client_id || null) : null,
        prospect_name: values.client_type === 'prospect' ? (values.prospect_name || null) : null,
        prospect_email: values.client_type === 'prospect' ? (values.prospect_email || null) : null,
        valid_until: values.valid_until ? format(values.valid_until, 'yyyy-MM-dd') : null,
        total_value: values.total_value ?? null,
      })

      // 2. Upload the file
      setUploadProgress('uploading')
      const { workspaceUserId } = await resolveWorkspace()
      const publicUrl = await uploadProposalFile(proposal.id, workspaceUserId, selectedFile)

      // 3. Save file_url back to the proposal
      await updateProposal.mutateAsync({ id: proposal.id, file_url: publicUrl })
      setUploadProgress('done')

      toast.success('Proposal uploaded')
      onOpenChange(false)
      navigate(`/proposals/${proposal.id}`)
    } catch (err) {
      setUploadProgress(null)
      if (err instanceof ProposalLimitError) {
        onOpenChange(false)
        onUpgradeNeeded?.()
      } else {
        toast.error(err.message || 'Something went wrong')
      }
    }
  }

  const isLoading = isSubmitting || uploadProgress === 'uploading'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Proposal</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-1">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="upload-title">Title <span className="text-destructive">*</span></Label>
            <Input
              id="upload-title"
              placeholder="e.g. Social Media Retainer — Q2 2026"
              {...register('title')}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Client / Prospect */}
          <div className="space-y-1.5">
            <Label>For <span className="text-destructive">*</span></Label>
            <Controller
              control={control}
              name="client_type"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v)
                    setValue('client_id', '')
                    setValue('prospect_name', '')
                    setValue('prospect_email', '')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Existing client</SelectItem>
                    <SelectItem value="prospect">New prospect</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {clientType === 'client' ? (
            <div className="space-y-1.5">
              <Label htmlFor="upload-client">Client <span className="text-destructive">*</span></Label>
              <Controller
                control={control}
                name="client_id"
                render={({ field }) => (
                  <Select value={field.value || ''} onValueChange={field.onChange}>
                    <SelectTrigger id="upload-client">
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.client_id && (
                <p className="text-xs text-destructive">{errors.client_id.message}</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="upload-prospect-name">Prospect name <span className="text-destructive">*</span></Label>
                <Input
                  id="upload-prospect-name"
                  placeholder="e.g. Acme Corp"
                  {...register('prospect_name')}
                />
                {errors.prospect_name && (
                  <p className="text-xs text-destructive">{errors.prospect_name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="upload-prospect-email">Prospect email</Label>
                <Input
                  id="upload-prospect-email"
                  type="email"
                  placeholder="contact@acmecorp.com"
                  {...register('prospect_email')}
                />
                {errors.prospect_email && (
                  <p className="text-xs text-destructive">{errors.prospect_email.message}</p>
                )}
              </div>
            </div>
          )}

          {/* Valid Until + Total Value — side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valid until</Label>
              <Controller
                control={control}
                name="valid_until"
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !field.value && 'text-muted-foreground',
                        )}
                      >
                        <CalendarIcon className="mr-2 size-4" />
                        {field.value ? format(field.value, 'd MMM yyyy') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="upload-total">Deal value <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
              <Input
                id="upload-total"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                {...register('total_value')}
              />
              {errors.total_value && (
                <p className="text-xs text-destructive">{errors.total_value.message}</p>
              )}
            </div>
          </div>

          {/* File upload */}
          <div className="space-y-1.5">
            <Label>Proposal file <span className="text-destructive">*</span></Label>

            {selectedFile ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-muted/30">
                <FileText className="size-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={() => {
                    setSelectedFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 px-4 py-8 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/20 transition-colors cursor-pointer"
              >
                <Upload className="size-6 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">Click to upload or drag & drop</p>
                  <p className="text-xs text-muted-foreground mt-0.5">PDF only · max 20 MB</p>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />

            {fileError && (
              <p className="text-xs text-destructive">{fileError}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {uploadProgress === 'uploading' ? 'Uploading…' : 'Creating…'}
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  Upload Proposal
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
