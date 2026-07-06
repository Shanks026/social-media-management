import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CONFIDENTIAL_DEFAULT_CATEGORIES } from '@/lib/permissions'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Archive,
  ArrowLeft,
  Building2,
  Check,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  ShieldAlert,
  Target,
  Video,
  X,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  Attachment,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
} from '@/components/ui/attachment'
import { cn } from '@/lib/utils'
import { formatFileSize } from '@/lib/helper'
import { useClients } from '@/api/clients'
import { useProspects } from '@/api/prospects'
import DocumentUploadZone from './DocumentUploadZone'

// ── File type helpers ──────────────────────────────────────────────────────

function getFileTypeMeta(filename) {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf':
      return { icon: FileText, bg: 'bg-red-100 dark:bg-red-950', color: 'text-red-600 dark:text-red-400' }
    case 'doc':
    case 'docx':
      return { icon: FileText, bg: 'bg-blue-100 dark:bg-blue-950', color: 'text-blue-600 dark:text-blue-400' }
    case 'xls':
    case 'xlsx':
      return { icon: FileSpreadsheet, bg: 'bg-green-100 dark:bg-green-950', color: 'text-green-600 dark:text-green-400' }
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
      return { icon: ImageIcon, bg: 'bg-purple-100 dark:bg-purple-950', color: 'text-purple-600 dark:text-purple-400' }
    case 'mp4':
    case 'mov':
      return { icon: Video, bg: 'bg-orange-100 dark:bg-orange-950', color: 'text-orange-600 dark:text-orange-400' }
    case 'zip':
      return { icon: Archive, bg: 'bg-amber-100 dark:bg-amber-950', color: 'text-amber-600 dark:text-amber-400' }
    default:
      return { icon: FileIcon, bg: 'bg-muted', color: 'text-muted-foreground' }
  }
}

function SelectedFileAttachment({ file, onClear, disabled, uploadProgress }) {
  const { icon: Icon } = getFileTypeMeta(file.name)
  const isUploading = uploadProgress !== null && uploadProgress !== undefined
  const state = isUploading ? 'uploading' : 'idle'

  return (
    <Attachment state={state} className="w-full">
      <AttachmentMedia>
        <Icon />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{file.name}</AttachmentTitle>
        <AttachmentDescription>
          {isUploading ? `Uploading · ${uploadProgress}%` : formatFileSize(file.size)}
        </AttachmentDescription>
      </AttachmentContent>
      {!disabled && (
        <AttachmentActions>
          <AttachmentAction aria-label={`Remove ${file.name}`} onClick={onClear}>
            <X />
          </AttachmentAction>
        </AttachmentActions>
      )}
    </Attachment>
  )
}

// ── Stepper indicator ──────────────────────────────────────────────────────

function StepDot({ number, label, state }) {
  return (
    <div className="flex items-center gap-2 min-w-0 shrink">
      <div
        className={cn(
          'flex size-6 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300',
          state === 'completed' && 'bg-primary text-primary-foreground',
          state === 'active' && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
          state === 'upcoming' && 'bg-muted text-muted-foreground',
        )}
      >
        {state === 'completed' ? <Check className="size-3" strokeWidth={3} /> : number}
      </div>
      <span
        className={cn(
          'text-sm font-medium truncate transition-colors duration-300',
          state === 'upcoming' && 'text-muted-foreground',
        )}
      >
        {label}
      </span>
    </div>
  )
}

// ── Exports ────────────────────────────────────────────────────────────────

export const DOCUMENT_CATEGORIES = [
  'Contract',
  'NDA',
  'Brand Guidelines',
  'Creative Brief',
  'Brand Assets',
  'Meeting Notes',
  'Invoice / Finance',
  'SOP',
  'Other',
]

export const PROSPECT_DOCUMENT_CATEGORIES = [
  'Pitch Deck',
  'Case Study',
  'NDA',
  'Discovery Notes',
  'Contract',
  'Other',
]

/**
 * Props:
 *   open               — boolean
 *   onOpenChange       — setter
 *   file               — File object or null (null = step 1)
 *   onFileSelected     — (file: File | null) => void — null clears back to step 1
 *   onConfirm          — async ({ displayName, category, clientId, notes }) => void
 *   uploadProgress     — 0–100 or null
 *   showClientSelector — shows client/prospect dropdown (global documents page)
 *   defaultClientId    — pre-selected value e.g. "client:uuid"
 */
export default function UploadMetaDialog({
  open,
  onOpenChange,
  file,
  onFileSelected,
  onConfirm,
  uploadProgress,
  showClientSelector = false,
  defaultClientId,
  categories = DOCUMENT_CATEGORIES,
}) {
  const isUploading = uploadProgress !== null && uploadProgress !== undefined
  const step = file ? 2 : 1

  const { data: clientsData } = useClients()
  const internalAccount = clientsData?.internalAccount
  const realClients = clientsData?.realClients ?? []
  const { data: prospectsData } = useProspects()
  const prospects = prospectsData ?? []

  const defaultLinkTarget = defaultClientId ?? ''

  const schema = z.object({
    displayName: z.string().min(1, 'Name is required').max(200),
    category: z.string().min(1, 'Category is required'),
    notes: z.string().max(500).optional(),
    isConfidential: z.boolean(),
    ...(showClientSelector
      ? { linkTarget: z.string().optional() }
      : {}),
  })

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: '',
      category: DOCUMENT_CATEGORIES.at(-1) ?? 'Other',
      notes: '',
      isConfidential: false,
      ...(showClientSelector ? { linkTarget: defaultLinkTarget } : {}),
    },
  })

  const linkTarget = useWatch({ control: form.control, name: 'linkTarget' })
  const watchedCategory = useWatch({ control: form.control, name: 'category' })

  // Auto-check confidential when category is a sensitive type
  useEffect(() => {
    if (CONFIDENTIAL_DEFAULT_CATEGORIES.includes(watchedCategory)) {
      form.setValue('isConfidential', true)
    }
  }, [watchedCategory, form])

  const activeCategories = useMemo(() => {
    if (!showClientSelector) return categories
    return linkTarget?.startsWith('prospect:')
      ? PROSPECT_DOCUMENT_CATEGORIES
      : DOCUMENT_CATEGORIES
  }, [showClientSelector, linkTarget, categories])

  useEffect(() => {
    if (showClientSelector && linkTarget) {
      form.setValue('category', activeCategories.at(-1) ?? 'Other')
    }
  }, [linkTarget, activeCategories, showClientSelector, form])

  useEffect(() => {
    if (file) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
      const defaultCat = activeCategories.at(-1) ?? 'Other'
      form.reset({
        displayName: nameWithoutExt,
        category: defaultCat,
        notes: '',
        isConfidential: CONFIDENTIAL_DEFAULT_CATEGORIES.includes(defaultCat),
        ...(showClientSelector ? { linkTarget: defaultLinkTarget } : {}),
      })
    }
  }, [file, defaultLinkTarget, showClientSelector, form, activeCategories])

  async function handleSubmit({ linkTarget: lt, isConfidential, ...rest }) {
    let clientId, prospectId
    if (lt?.startsWith('prospect:')) prospectId = lt.replace('prospect:', '')
    else if (lt?.startsWith('client:')) clientId = lt.replace('client:', '')
    else if (showClientSelector) clientId = internalAccount?.id
    await onConfirm({ ...rest, isConfidential, clientId, prospectId })
  }

  return (
    <Dialog open={open} onOpenChange={isUploading ? undefined : onOpenChange}>
      <DialogContent className="w-[90vw] max-w-lg overflow-hidden p-0 gap-0">

        {/* ── Stepper header ─────────────────────────────────────────────── */}
        <div className="pl-6 pr-12 pt-6 pb-5 border-b">
          <DialogTitle className="text-base font-semibold mb-4">Upload Document</DialogTitle>

          <div className="flex items-center gap-2 min-w-0">
            <StepDot
              number={1}
              label="Select file"
              state={step > 1 ? 'completed' : 'active'}
            />

            {/* Animated connector */}
            <div className="relative flex-1 h-px bg-border overflow-hidden">
              <div
                className="absolute inset-0 bg-primary origin-left transition-transform duration-500 ease-in-out"
                style={{ transform: step > 1 ? 'scaleX(1)' : 'scaleX(0)' }}
              />
            </div>

            <StepDot
              number={2}
              label="Document details"
              state={step === 2 ? 'active' : 'upcoming'}
            />
          </div>
        </div>

        {/* ── Sliding panels ─────────────────────────────────────────────── */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="relative overflow-hidden" style={{ height: 'min(58vh, 420px)' }}>

              {/* ── Panel 1: Upload zone ── */}
              <div
                className="absolute inset-0 p-6 transition-transform duration-300 ease-in-out"
                style={{ transform: step === 2 ? 'translateX(-100%)' : 'translateX(0)' }}
                aria-hidden={step !== 1}
              >
                <DocumentUploadZone
                  onFileSelected={onFileSelected}
                  disabled={isUploading}
                  className="h-full"
                />
              </div>

              {/* ── Panel 2: File card + fields ── */}
              <div
                className="absolute inset-0 p-6 overflow-y-auto flex flex-col gap-4 transition-transform duration-300 ease-in-out"
                style={{ transform: step === 2 ? 'translateX(0)' : 'translateX(100%)' }}
                aria-hidden={step !== 2}
              >
                  {file && (
                    <SelectedFileAttachment
                      file={file}
                      onClear={() => onFileSelected(null)}
                      disabled={isUploading}
                      uploadProgress={uploadProgress}
                    />
                  )}

                  <div className="flex flex-col gap-4">
                    {showClientSelector && (
                      <FormField
                        control={form.control}
                        name="linkTarget"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Link to</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                              disabled={isUploading}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select client or prospect" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {internalAccount && (
                                  <SelectGroup>
                                    <SelectLabel>Workspace</SelectLabel>
                                    <SelectItem value={`client:${internalAccount.id}`}>
                                      <span className="flex items-center gap-2">
                                        {internalAccount.logo_url ? (
                                          <img src={internalAccount.logo_url} alt="" className="size-4 rounded-full object-cover" />
                                        ) : (
                                          <Building2 className="size-4 text-muted-foreground" />
                                        )}
                                        {internalAccount.name}
                                        <span className="text-muted-foreground">(You)</span>
                                      </span>
                                    </SelectItem>
                                  </SelectGroup>
                                )}
                                {realClients.length > 0 && (
                                  <SelectGroup>
                                    <SelectLabel>Clients</SelectLabel>
                                    {realClients.map((c) => (
                                      <SelectItem key={c.id} value={`client:${c.id}`}>
                                        <span className="flex items-center gap-2">
                                          {c.logo_url ? (
                                            <img src={c.logo_url} alt="" className="size-4 rounded-full object-cover" />
                                          ) : (
                                            <Building2 className="size-4 text-muted-foreground" />
                                          )}
                                          {c.name}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                )}
                                {prospects.length > 0 && (
                                  <SelectGroup>
                                    <SelectLabel>Prospects</SelectLabel>
                                    {prospects.map((p) => (
                                      <SelectItem key={p.id} value={`prospect:${p.id}`}>
                                        <span className="flex items-center gap-2">
                                          <Target className="size-4 text-muted-foreground" />
                                          {p.business_name}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Document name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Q1 Contract"
                              disabled={isUploading}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={isUploading}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {activeCategories.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Notes{' '}
                            <span className="text-muted-foreground font-normal">(Optional)</span>
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Add any context or notes about this document…"
                              className="resize-none text-sm"
                              rows={3}
                              disabled={isUploading}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isConfidential"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <ShieldAlert className="size-4 text-amber-500 shrink-0" />
                              <div>
                                <p className="text-sm font-medium">Confidential</p>
                                <p className="text-xs text-muted-foreground">Hidden from team members — visible to admins only</p>
                              </div>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={isUploading}
                              />
                            </FormControl>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  {isUploading && (
                    <div className="space-y-1.5 mt-auto pt-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Uploading…</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-1.5" />
                    </div>
                  )}
              </div>
            </div>

            {/* ── Footer ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div>
                {step === 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={() => onFileSelected(null)}
                    disabled={isUploading}
                  >
                    <ArrowLeft className="size-3.5" />
                    Back
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isUploading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!file || isUploading}>
                  {isUploading ? 'Uploading…' : 'Upload'}
                </Button>
              </div>
            </div>
          </form>
        </Form>

      </DialogContent>
    </Dialog>
  )
}
