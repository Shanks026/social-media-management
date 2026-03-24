import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Building2, Target } from 'lucide-react'
import { formatFileSize } from '@/lib/helper'
import { useClients } from '@/api/clients'
import { useProspects } from '@/api/prospects'

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
 * Dialog shown after file selection to collect metadata before uploading.
 *
 * Props:
 *   open               — boolean
 *   onOpenChange       — setter
 *   file               — File object
 *   onConfirm          — async ({ displayName, category, clientId, notes }) => void
 *   uploadProgress     — 0–100 or null (null = idle)
 *   showClientSelector — when true, shows a client dropdown (global page)
 *   defaultClientId    — pre-selected client ID
 */
export default function UploadMetaDialog({
  open,
  onOpenChange,
  file,
  onConfirm,
  uploadProgress,
  showClientSelector = false,
  defaultClientId,
  categories = DOCUMENT_CATEGORIES,
}) {
  const isUploading = uploadProgress !== null && uploadProgress !== undefined

  const { data: clientsData } = useClients()
  const internalAccount = clientsData?.internalAccount
  const realClients = clientsData?.realClients ?? []
  const { data: prospectsData } = useProspects()
  const prospects = prospectsData ?? []

  // defaultClientId is already a prefixed "client:uuid" string from the caller
  const defaultLinkTarget = defaultClientId ?? ''

  const schema = z.object({
    displayName: z.string().min(1, 'Name is required').max(200),
    category: z.string().min(1, 'Category is required'),
    notes: z.string().max(500).optional(),
    ...(showClientSelector
      ? { linkTarget: z.string().min(1, 'Link target is required') }
      : {}),
  })

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: '',
      category: DOCUMENT_CATEGORIES.at(-1) ?? 'Other',
      notes: '',
      ...(showClientSelector ? { linkTarget: defaultLinkTarget } : {}),
    },
  })

  // When the link target selector is shown, derive categories from the selection
  const linkTarget = form.watch('linkTarget')
  const activeCategories = useMemo(() => {
    if (!showClientSelector) return categories
    return linkTarget?.startsWith('prospect:')
      ? PROSPECT_DOCUMENT_CATEGORIES
      : DOCUMENT_CATEGORIES
  }, [showClientSelector, linkTarget, categories])

  // Reset category to last item of new list when link target changes
  useEffect(() => {
    if (showClientSelector && linkTarget) {
      form.setValue('category', activeCategories.at(-1) ?? 'Other')
    }
  }, [linkTarget, activeCategories, showClientSelector, form])

  // Pre-fill when file or defaultClientId changes
  useEffect(() => {
    if (file) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
      form.reset({
        displayName: nameWithoutExt,
        category: activeCategories.at(-1) ?? 'Other',
        notes: '',
        ...(showClientSelector ? { linkTarget: defaultLinkTarget } : {}),
      })
    }
  }, [file, defaultLinkTarget, showClientSelector, form])

  async function handleSubmit({ linkTarget, ...rest }) {
    let clientId, prospectId
    if (linkTarget?.startsWith('prospect:')) {
      prospectId = linkTarget.replace('prospect:', '')
    } else if (linkTarget?.startsWith('client:')) {
      clientId = linkTarget.replace('client:', '')
    }
    await onConfirm({ ...rest, clientId, prospectId })
  }

  return (
    <Dialog open={open} onOpenChange={isUploading ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>

        {file && (
          <p className="text-xs text-muted-foreground -mt-1">
            {file.name} &middot; {formatFileSize(file.size)}
          </p>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Link to selector — only on global page */}
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
                                  <img
                                    src={internalAccount.logo_url}
                                    alt=""
                                    className="size-4 rounded-full object-cover"
                                  />
                                ) : (
                                  <Building2 className="size-4 text-muted-foreground" />
                                )}
                                {internalAccount.name}
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
                                    <img
                                      src={c.logo_url}
                                      alt=""
                                      className="size-4 rounded-full object-cover"
                                    />
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
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
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

            {isUploading && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Uploading…</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-1.5" />
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUploading}>
                {isUploading ? 'Uploading…' : 'Upload'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
