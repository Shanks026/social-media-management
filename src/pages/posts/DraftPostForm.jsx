import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  X,
  Instagram,
  Linkedin,
  Youtube,
  Facebook,
  Globe,
  Loader2,
  Plus,
  Calendar as CalendarIcon,
  AlertCircle,
  Film, // Added for video icon
} from 'lucide-react'

import { createDraftPost, updatePost } from '@/api/posts'
import { uploadPostImage } from '@/api/storage'
import { fetchClientById } from '@/api/clients'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Calendar } from '@/components/ui/calendar'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { format, setHours, setMinutes } from 'date-fns'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useSubscription } from '@/api/useSubscription'
import { Skeleton } from '@/components/ui/skeleton'

const MAX_FILES = 5

// Helper to determine if a URL/File is a video
const isVideoSource = (url) => {
  if (!url) return false
  const videoExtensions = ['.mp4', '.mov', '.webm', '.ogg', '.m4v']
  return (
    videoExtensions.some((ext) => url.toLowerCase().includes(ext)) ||
    url.startsWith('blob:') || // Local previews
    url.includes('video')
  )
}

const PLATFORM_CONFIG = {
  instagram: {
    label: 'Instagram',
    icon: Instagram,
    active:
      'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-500/20 dark:text-violet-400 dark:border-violet-500/30',
  },
  linkedin: {
    label: 'LinkedIn',
    icon: Linkedin,
    active:
      'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-600/20 dark:text-blue-400 dark:border-blue-600/30',
  },
  facebook: {
    label: 'Facebook',
    icon: Facebook,
    active:
      'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-400 dark:border-cyan-500/30',
  },
  google_business: {
    label: 'Google Business',
    icon: Globe,
    active:
      'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30',
  },
  youtube: {
    label: 'YouTube',
    icon: Youtube,
    active:
      'bg-red-100 text-red-800 border-red-200 dark:bg-red-600/20 dark:text-red-400 dark:border-red-600/30',
  },
  twitter: {
    label: 'Twitter/X',
    icon: Globe,
    active:
      'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-500/20 dark:text-slate-400 dark:border-slate-500/30',
  },
}

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Post content is required'),
  platforms: z.array(z.string()).min(1, 'Select at least one platform'),
  images: z.array(z.any()).max(MAX_FILES).default([]),
  target_date: z.date().optional(),
})

export default function DraftPostForm({
  clientId,
  open,
  onOpenChange,
  initialData = null,
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: subscription } = useSubscription()
  const isEditMode = !!initialData

  const [previews, setPreviews] = useState([])
  const fileInputRef = useRef(null)
  const isStorageFull =
    subscription?.storage_used_bytes >= subscription?.storage_max_bytes

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      content: '',
      platforms: [],
      images: [],
      target_date: undefined,
    },
  })

  useEffect(() => {
    if (initialData && open) {
      const platformData = Array.isArray(initialData.platform)
        ? initialData.platform
        : [initialData.platform].filter(Boolean)

      form.reset({
        title: initialData.title || '',
        content: initialData.content || '',
        platforms: platformData.map((p) => p.toLowerCase().replace(' ', '_')),
        images: [],
        target_date: initialData.target_date
          ? new Date(initialData.target_date)
          : undefined,
      })
      setPreviews(initialData.media_urls || [])
    }
  }, [initialData, open, form])

  const { data: client, isLoading: isClientLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => fetchClientById(clientId),
    enabled: !!clientId && open,
  })

  const availablePlatforms = client?.platforms || []

  const mutation = useMutation({
    mutationFn: async (values) => {
      if (isEditMode) {
        const initialUrls = initialData.media_urls || []
        const urlsToRemove = initialUrls.filter(
          (url) => !previews.includes(url),
        )

        if (urlsToRemove.length > 0) {
          const pathsToRemove = urlsToRemove
            .map((url) => url.split('/post-media/')[1])
            .filter(Boolean)

          if (pathsToRemove.length > 0) {
            await supabase.storage.from('post-media').remove(pathsToRemove)
          }
        }
      }

      // Handle New Media Uploads (Images and Videos)
      const uploadPromises = (values.images || []).map((file) =>
        uploadPostImage({ file, clientId }),
      )
      const newMediaUrls = await Promise.all(uploadPromises)

      const existingRemoteUrls = previews.filter(
        (p) => typeof p === 'string' && p.startsWith('http'),
      )
      const finalMediaUrls = [...existingRemoteUrls, ...newMediaUrls]

      const payload = {
        clientId,
        title: values.title,
        content: values.content,
        mediaUrls: finalMediaUrls,
        platforms: values.platforms,
        target_date: values.target_date?.toISOString(),
        userId: user?.id,
        adminNotes: values.admin_notes || null,
      }

      if (isEditMode) {
        return updatePost(initialData.version_id, payload)
      }

      return createDraftPost(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft-posts', clientId] })
      queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] })
      if (isEditMode) {
        queryClient.invalidateQueries({
          queryKey: ['post-version', initialData.version_id],
        })
      }
      toast.success(isEditMode ? 'Post updated' : 'Draft created')
      resetAndClose()
    },
    onError: (error) => {
      console.error('Mutation Error:', error)
      toast.error(error.message || 'Something went wrong')
    },
  })

  function resetAndClose() {
    form.reset()
    previews.forEach((url) => {
      if (typeof url === 'string' && url.startsWith('blob:')) {
        URL.revokeObjectURL(url)
      }
    })
    setPreviews([])
    onOpenChange(false)
  }

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || [])
    const currentFiles = form.getValues('images') || []
    const remainingSlots = MAX_FILES - previews.length
    const addedFiles = files.slice(0, remainingSlots)

    const newFilesList = [...currentFiles, ...addedFiles]
    form.setValue('images', newFilesList)

    const newLocalPreviews = addedFiles.map((file) => URL.createObjectURL(file))
    setPreviews((prev) => [...prev, ...newLocalPreviews])
  }

  const removeImage = (index) => {
    const itemToRemove = previews[index]
    if (typeof itemToRemove === 'string' && itemToRemove.startsWith('blob:')) {
      const currentFiles = form.getValues('images')
      const localFileIndex = previews
        .slice(0, index)
        .filter((p) => p.startsWith('blob:')).length
      const newFiles = currentFiles.filter((_, i) => i !== localFileIndex)
      form.setValue('images', newFiles)
      URL.revokeObjectURL(itemToRemove)
    }
    setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) resetAndClose()
        else onOpenChange(val)
      }}
    >
      <DialogContent className="sm:max-w-[600px] max-h-[95vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>
            {isEditMode ? 'Edit Draft Post' : 'Create Draft Post'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Media Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <FormLabel>
                    Media Assets ({previews.length}/{MAX_FILES})
                  </FormLabel>
                  {isStorageFull && (
                    <Badge
                      variant="destructive"
                      className="text-[10px] animate-pulse"
                    >
                      Storage Full - Upgrade Plan
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-5 gap-4">
                  {previews.map((url, index) => (
                    <div
                      key={url}
                      className="relative aspect-square rounded-lg border overflow-hidden bg-muted shadow-sm"
                    >
                      {/* Dynamic Rendering for Image vs Video */}
                      {isVideoSource(url) ? (
                        <div className="relative h-full w-full">
                          <video
                            src={url}
                            className="h-full w-full object-cover"
                            muted
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <Film className="h-6 w-6 text-white opacity-80" />
                          </div>
                        </div>
                      ) : (
                        <img
                          src={url}
                          alt="Preview"
                          className="h-full w-full object-cover"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 bg-background/90 p-1 rounded-full border shadow-sm hover:bg-destructive hover:text-white transition-all"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {previews.length < MAX_FILES && (
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          disabled={isStorageFull}
                          onClick={() => fileInputRef.current?.click()}
                          className={cn(
                            'flex aspect-square items-center justify-center rounded-lg border-2 border-dashed transition-all',
                            isStorageFull
                              ? 'opacity-50 cursor-not-allowed bg-muted/50 border-muted'
                              : 'hover:bg-accent hover:border-primary/50',
                          )}
                        >
                          <div className="flex flex-col items-center gap-1 text-muted-foreground">
                            {isStorageFull ? (
                              <AlertCircle className="h-5 w-5 text-destructive" />
                            ) : (
                              <Plus className="h-6 w-6" />
                            )}
                            <span className="text-[10px] font-bold uppercase">
                              {isStorageFull ? 'Locked' : 'Add'}
                            </span>
                          </div>
                        </button>
                      </TooltipTrigger>
                      {isStorageFull && (
                        <TooltipContent side="bottom">
                          <p className="text-xs">
                            Your storage limit of{' '}
                            {subscription?.storage_display?.limit}GB is reached.
                          </p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  )}
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*" // Support videos now
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </div>

              {/* Platform Select */}
              <FormField
                control={form.control}
                name="platforms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">
                      Target Platforms
                    </FormLabel>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {isClientLoading ? (
                        <Skeleton className="h-8 w-32" />
                      ) : (
                        Object.entries(PLATFORM_CONFIG)
                          .filter(([id]) => availablePlatforms.includes(id))
                          .map(([id, config]) => {
                            const Icon = config.icon
                            const isSelected = field.value?.includes(id)
                            return (
                              <label key={id} className="cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const current = field.value || []
                                    field.onChange(
                                      e.target.checked
                                        ? [...current, id]
                                        : current.filter((v) => v !== id),
                                    )
                                  }}
                                />
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'flex items-center gap-2 px-3 py-1.5 transition-all',
                                    'bg-secondary/40 text-muted-foreground',
                                    isSelected && config.active,
                                  )}
                                >
                                  <Icon
                                    className={cn(
                                      'h-3.5 w-3.5',
                                      isSelected ? 'opacity-100' : 'opacity-50',
                                    )}
                                  />
                                  {config.label}
                                </Badge>
                              </label>
                            )
                          })
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                {/* Date Picker */}
                <FormField
                  control={form.control}
                  name="target_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Proposed Schedule Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground',
                              )}
                            >
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < new Date(new Date().setHours(0, 0, 0, 0))
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Time Picker */}
                <FormItem className="flex flex-col">
                  <FormLabel>Time</FormLabel>
                  <Select
                    disabled={!form.watch('target_date')}
                    value={
                      form.watch('target_date')
                        ? format(form.watch('target_date'), 'HH:mm')
                        : ''
                    }
                    onValueChange={(val) => {
                      const [hours, minutes] = val.split(':').map(Number)
                      const current =
                        form.getValues('target_date') || new Date()
                      form.setValue(
                        'target_date',
                        setMinutes(setHours(current, hours), minutes),
                      )
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select time" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[200px]">
                      {Array.from({ length: 48 }).map((_, i) => {
                        const hour = Math.floor(i / 2)
                          .toString()
                          .padStart(2, '0')
                        const min = i % 2 === 0 ? '00' : '30'
                        const time = `${hour}:${min}`
                        return (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </FormItem>
              </div>

              {/* Title and Caption */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter post title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Caption</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Write your post content..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="p-6 pt-2 bg-background">
              <div className="flex w-full justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetAndClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  className="px-8"
                >
                  {mutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isEditMode ? (
                    'Update Draft'
                  ) : (
                    'Save Draft'
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
