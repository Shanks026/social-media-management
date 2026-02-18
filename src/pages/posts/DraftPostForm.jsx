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
  Film,
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

// Improved helper for remote URLs
const isRemoteVideo = (url) => {
  if (!url) return false
  const videoExtensions = ['.mp4', '.mov', '.webm', '.ogg', '.m4v']
  return (
    videoExtensions.some((ext) => url.toLowerCase().includes(ext)) ||
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

// Helper to check if a file/preview is a video
const isVideoContent = (fileOrPreview) => {
  if (!fileOrPreview) return false
  // Check if it's our preview object
  if (fileOrPreview.type === 'video') return true
  // Check if it's a File object
  if (fileOrPreview instanceof File && fileOrPreview.type.startsWith('video/'))
    return true
  // Check if it's a remote URL string (fallback)
  if (typeof fileOrPreview === 'string') return isRemoteVideo(fileOrPreview)
  return false
}

const formSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    content: z.string().min(1, 'Post content is required'),
    platforms: z.array(z.string()).min(1, 'Select at least one platform'),
    images: z.array(z.any()).max(MAX_FILES).default([]),
    target_date: z.date().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.platforms.includes('youtube')) {
      // Check if there is at least one video in images
      // Note: 'images' in form state contains File objects.
      // We might also have existing remote URLs if in edit mode, but 'images' usually tracks *new* files.
      // Wait, 'images' in form values only tracks NEW files?
      // Let's check how 'images' is used. It seems to only collect new files from inputs.
      // But we need to validate against ALL media (existing + new).
      // Since zod validation runs on submit, and 'previews' state holds the truth of what's selected...
      // We can't easily access 'previews' here inside pure Zod.
      // However, we can trust the component validation to prevent submit, OR pass context.
      // A simpler way: The component logic handles most of it.
      // But for strict schema safety:
      // We'll skip strict file checking here if it's too complex to access current state,
      // BUT we can check if 'images' has a video IF we only had new files.
      // Better strategy: "DraftPostForm" keeps 'previews' updated. We should rely on component validation or inject current media into the form values if needed.
      // For now, let's add a custom check in handleSubmit or rely on the UI restrictions we are building.
    }
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

  // State now stores objects: { url: string, type: 'image' | 'video' }
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

  // Derived state for validation
  const watchedPlatforms = form.watch('platforms') || []
  const hasVideo = previews.some((p) => p.type === 'video')
  const hasMedia = previews.length > 0
  const isYoutubeSelected = watchedPlatforms.includes('youtube')

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

      // Initialize with correct types for remote URLs
      const initialPreviews = (initialData.media_urls || []).map((url) => ({
        url,
        type: isRemoteVideo(url) ? 'video' : 'image',
      }))
      setPreviews(initialPreviews)
    }
  }, [initialData, open, form])

  const { data: client, isLoading: isClientLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => fetchClientById(clientId),
    enabled: !!clientId && open,
  })

  const availablePlatforms = client?.platforms || []

  // Custom Submit Handler to enforce Youtube Constraint
  const onSubmit = (values) => {
    if (values.platforms.includes('youtube') && !hasVideo) {
      form.setError('platforms', {
        type: 'manual',
        message:
          'YouTube requires a video file. Please upload a video or deselect YouTube.',
      })
      return
    }
    mutation.mutate(values)
  }

  const mutation = useMutation({
    mutationFn: async (values) => {
      if (isEditMode) {
        const initialUrls = initialData.media_urls || []
        const currentUrls = previews.map((p) => p.url)
        const urlsToRemove = initialUrls.filter(
          (url) => !currentUrls.includes(url),
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

      const uploadPromises = (values.images || []).map((file) =>
        uploadPostImage({ file, clientId }),
      )
      const newMediaUrls = await Promise.all(uploadPromises)

      const existingRemoteUrls = previews
        .filter((p) => p.url.startsWith('http'))
        .map((p) => p.url)

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

      if (isEditMode) return updatePost(initialData.version_id, payload)
      return createDraftPost(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft-posts', clientId] })
      queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] })
      if (isEditMode)
        queryClient.invalidateQueries({
          queryKey: ['post-version', initialData.version_id],
        })
      toast.success(isEditMode ? 'Post updated' : 'Draft created')
      resetAndClose()
    },
  })

  function resetAndClose() {
    form.reset()
    previews.forEach((p) => {
      if (p.url.startsWith('blob:')) URL.revokeObjectURL(p.url)
    })
    setPreviews([])
    onOpenChange(false)
  }

  const handleFileChange = (e) => {
    let files = Array.from(e.target.files || [])

    // Constraint: If YouTube selected, filter out non-videos
    if (isYoutubeSelected) {
      const videoFiles = files.filter((f) => f.type.startsWith('video/'))
      if (videoFiles.length < files.length) {
        toast.error('Only video files are allowed when YouTube is selected.')
      }
      files = videoFiles

      // Constraint: Single file only
      if (files.length > 1) {
        toast.warning('YouTube allows only one video. Taking the first one.')
        files = files.slice(0, 1)
      }
    }

    const currentFiles = form.getValues('images') || []

    // Calculate slots based on mode
    const maxAllowed = isYoutubeSelected ? 1 : MAX_FILES
    const remainingSlots = maxAllowed - previews.length

    // If YouTube is selected and we already have 1, remaining is 0.
    // If we're uploading 1 new one, and previews is 0, we can add 1.
    if (remainingSlots <= 0 && isYoutubeSelected) {
      toast.error('You can only upload 1 video for YouTube.')
      return
    }

    const addedFiles = files.slice(0, remainingSlots)

    form.setValue('images', [...currentFiles, ...addedFiles])

    const newLocalPreviews = addedFiles.map((file) => ({
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video') ? 'video' : 'image',
    }))
    setPreviews((prev) => [...prev, ...newLocalPreviews])
  }

  const removeImage = (index) => {
    const itemToRemove = previews[index]
    if (itemToRemove.url.startsWith('blob:')) {
      const currentFiles = form.getValues('images')
      // Calculate index relative to the 'images' array (local files only)
      const localFileIndex = previews
        .slice(0, index)
        .filter((p) => p.url.startsWith('blob:')).length

      const newFiles = currentFiles.filter((_, i) => i !== localFileIndex)
      form.setValue('images', newFiles)
      URL.revokeObjectURL(itemToRemove.url)
    }

    const newPreviews = previews.filter((_, i) => i !== index)
    setPreviews(newPreviews)

    // Check if we removed the last video and YouTube is selected
    const remainingHasVideo = newPreviews.some((p) => p.type === 'video')
    if (isYoutubeSelected && !remainingHasVideo) {
      // Auto deselect YouTube or warn?
      // "If the user uploads an image, automatically deselect "YouTube" if it was previously active"
      // Logic here handles removal. If we remove the video, we should probably deselect YouTube to be safe.
      const currentPlatforms = form.getValues('platforms')
      form.setValue(
        'platforms',
        currentPlatforms.filter((p) => p !== 'youtube'),
      )
      toast.info('YouTube deselected because the video was removed.')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => (!val ? resetAndClose() : onOpenChange(val))}
    >
      <DialogContent className="sm:max-w-[600px] max-h-[95vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>
            {isEditMode ? 'Edit Draft Post' : 'Create Draft Post'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                  {previews.map((item, index) => (
                    <div
                      key={item.url}
                      className="relative aspect-square rounded-lg border overflow-hidden bg-muted shadow-sm"
                    >
                      {item.type === 'video' ? (
                        <div className="relative h-full w-full">
                          <video
                            src={item.url}
                            className="h-full w-full object-cover"
                            muted
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <Film className="h-6 w-6 text-white opacity-80" />
                          </div>
                        </div>
                      ) : (
                        <img
                          src={item.url}
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

                  {/* Add Button Logic based on YouTube selection */}
                  {previews.length < (isYoutubeSelected ? 1 : MAX_FILES) && (
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
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
                          <TooltipContent>Your storage is full.</TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                {/* Helper Text for YouTube */}
                {isYoutubeSelected && (
                  <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                    <AlertCircle size={12} />
                    YouTube: Single video upload only.
                  </p>
                )}

                <input
                  type="file"
                  multiple={!isYoutubeSelected} // Single file only for YouTube
                  accept={isYoutubeSelected ? 'video/*' : 'image/*,video/*'}
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

                            // Logic to disable YouTube
                            let isDisabled = false
                            let tooltipText = ''

                            if (id === 'youtube') {
                              // 1. Must have media (unless empty, but user can add later - wait, user requirement says "disabled unless user has uploaded a video file")
                              // Actually user said: "The 'YouTube' option... must be disabled (grayed out) unless the user has uploaded a video file."
                              // This implies we can't select it BEFORE uploading?
                              // "Validation Logic: If the user selects "YouTube" first..." -> This implies we CAN select it first.
                              // Let's interpret "Conditional Disabling":
                              // "Conditional Disabling: The "YouTube" option... must be disabled... unless the user has uploaded a video file."
                              // BUT checking requirement 2: "If the user selects "YouTube" first, restrict the file uploader..."
                              // These are contradictory.
                              // Interpretation: Verification logic in 'onSubmit' covers the "must have video" part.
                              // The "Disabled" part likely means: If I have *IMAGES* only, disable it. If I have *NOTHING*, maybe allow it so I can upload a video next?
                              // Let's stick to: Disable if there is content but NO video (handled below).
                              if (hasMedia && !hasVideo) {
                                isDisabled = true
                                tooltipText = 'YouTube requires a video file.'
                              }
                            }

                            const checkboxWithBadge = (
                              <label
                                key={id}
                                className={cn(
                                  'cursor-pointer',
                                  isDisabled && 'cursor-not-allowed opacity-50',
                                )}
                              >
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={isSelected}
                                  disabled={isDisabled}
                                  onChange={(e) => {
                                    if (isDisabled) return
                                    const current = field.value || []
                                    const isChecking = e.target.checked

                                    // Constraint: YouTube Single File Policy
                                    if (id === 'youtube' && isChecking) {
                                      if (previews.length > 1) {
                                        toast.error(
                                          'YouTube posts are limited to 1 video file. Please remove other files first.',
                                        )
                                        return // Prevent selection
                                      }
                                      // Also ensure no images (though isDisabled handles the 'no video' case, we might have 1 video + 1 image)
                                      const hasImages = previews.some(
                                        (p) => p.type !== 'video',
                                      )
                                      if (hasImages) {
                                        toast.error(
                                          'YouTube allows only video files. Please remove images.',
                                        )
                                        return
                                      }
                                    }

                                    field.onChange(
                                      isChecking
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

                            if (isDisabled) {
                              return (
                                <TooltipProvider key={id}>
                                  <Tooltip delayDuration={0}>
                                    <TooltipTrigger asChild>
                                      <div>{checkboxWithBadge}</div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{tooltipText}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )
                            }
                            return checkboxWithBadge
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
