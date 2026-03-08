import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  X,
  Loader2,
  Calendar as CalendarIcon,
  AlertCircle,
  Film,
  UploadCloud,
  Upload,
} from 'lucide-react'

import { createDraftPost, updatePost } from '@/api/posts'
import { uploadPostImage } from '@/api/storage'
import { fetchClientById } from '@/api/clients'
import { fetchActiveCampaignsByClient } from '@/api/campaigns'

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
import { Checkbox } from '@/components/ui/checkbox'

const MAX_FILES = 10

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
    logo: '/platformIcons/instagram.png',
    selected:
      'border-pink-400 bg-pink-50 text-pink-700 dark:border-pink-500/50 dark:bg-pink-500/15 dark:text-pink-300',
  },
  linkedin: {
    label: 'LinkedIn',
    logo: '/platformIcons/linkedin.png',
    selected:
      'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-600/15 dark:text-blue-300',
  },
  facebook: {
    label: 'Facebook',
    logo: '/platformIcons/facebook.png',
    selected:
      'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-500/50 dark:bg-sky-500/15 dark:text-sky-300',
  },
  google_business: {
    label: 'Google Business',
    logo: '/platformIcons/google_busines.png',
    selected:
      'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-300',
  },
  youtube: {
    label: 'YouTube',
    logo: '/platformIcons/youtube.png',
    selected:
      'border-red-500 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-600/15 dark:text-red-300',
  },
  twitter: {
    label: 'Twitter/X',
    logo: '/platformIcons/twitter.png',
    selected:
      'border-slate-700 bg-slate-100 text-slate-900 dark:border-slate-400/50 dark:bg-slate-500/15 dark:text-slate-200',
  },
}

// Helper to check if a file/preview is a video
// eslint-disable-next-line no-unused-vars
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
    target_date: z.date({
      required_error: 'Schedule date and time are required',
      invalid_type_error: 'Please select a valid date and time',
    }),
    client_id: z.string().optional(),
    campaign_id: z.string().optional(),
  })
  .superRefine((data) => {
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
  availableClients = [],
  open,
  onOpenChange,
  initialData = null,
  initialCampaignId = null,
  initialCampaignName = null,
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: subscription } = useSubscription()
  const isEditMode = !!initialData

  // State now stores objects: { url: string, type: 'image' | 'video' }
  const [previews, setPreviews] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)
  const isStorageFull = subscription?.storage_display?.percent >= 100

  const [perPlatformMode, setPerPlatformMode] = useState(false)
  // { [platformId]: { date: Date | null, time: '09:00' } }
  const [platformSchedulesState, setPlatformSchedulesState] = useState({})

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      content: '',
      platforms: [],
      images: [],
      target_date: undefined,
      client_id: '',
      campaign_id: '',
    },
  })

  // eslint-disable-next-line react-hooks/incompatible-library
  const formClientId = form.watch('client_id')
  const effectiveClientId = clientId || formClientId

  const [availableCampaigns, setAvailableCampaigns] = useState([])

  useEffect(() => {
    if (!effectiveClientId || !subscription?.campaigns) {
      if (!isEditMode) form.setValue('campaign_id', '')
      setAvailableCampaigns([])
      return
    }

    // Always set the campaign_id if providing an initial one
    if (initialCampaignId) {
      form.setValue('campaign_id', initialCampaignId)
    } else if (!isEditMode && !form.getValues('campaign_id')) {
      form.setValue('campaign_id', '')
    }

    fetchActiveCampaignsByClient(effectiveClientId)
      .then((data) => {
        setAvailableCampaigns(data)
        // Ensure initialCampaignId is selected if it's in the data and we haven't manually changed it
        if (initialCampaignId && data.some((c) => c.id === initialCampaignId)) {
          form.setValue('campaign_id', initialCampaignId)
        }
      })
      .catch(() => setAvailableCampaigns([]))
  }, [effectiveClientId, subscription?.campaigns, initialCampaignId, isEditMode, form])

  // Reset/Initialize form when opening for a NEW post
  useEffect(() => {
    if (open && !isEditMode) {
      if (clientId) form.setValue('client_id', clientId)
      if (initialCampaignId) form.setValue('campaign_id', initialCampaignId)
    }
  }, [open, isEditMode, clientId, initialCampaignId, form])

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
        client_id: initialData.client_id || '',
        campaign_id: initialData.campaign_id || '',
      })

      // Initialize with correct types for remote URLs
      const initialPreviews = (initialData.media_urls || []).map((url) => ({
        url,
        type: isRemoteVideo(url) ? 'video' : 'image',
      }))
      setPreviews(initialPreviews)

      // Populate per-platform scheduling state if present
      if (initialData.platform_schedules) {
        setPerPlatformMode(true)
        const state = {}
        Object.entries(initialData.platform_schedules).forEach(
          ([platform, { scheduled_at }]) => {
            const d = new Date(scheduled_at)
            state[platform] = { date: d, time: format(d, 'HH:mm') }
          },
        )
        setPlatformSchedulesState(state)
      } else {
        setPerPlatformMode(false)
        setPlatformSchedulesState({})
      }
    }
  }, [initialData, open, form])

  // Sync per-platform state rows when selected platforms change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!perPlatformMode) return
    const currentDate = form.getValues('target_date')
    setPlatformSchedulesState((prev) => {
      const next = {}
      watchedPlatforms.forEach((p) => {
        if (prev[p]) {
          next[p] = prev[p]
        } else {
          next[p] = {
            date: currentDate || null,
            time: currentDate ? format(currentDate, 'HH:mm') : '09:00',
          }
        }
      })
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedPlatforms.join(','), perPlatformMode])

  // Auto-compute target_date = earliest scheduled_at across all platforms
  useEffect(() => {
    if (!perPlatformMode) return
    const dates = Object.values(platformSchedulesState)
      .filter(({ date, time }) => date && time)
      .map(({ date, time }) => {
        const [hours, minutes] = time.split(':').map(Number)
        return setMinutes(setHours(date, hours), minutes)
      })
    if (!dates.length) return
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
    form.setValue('target_date', minDate)
  }, [platformSchedulesState, perPlatformMode, form])

  function buildPlatformSchedulesPayload(state) {
    return Object.fromEntries(
      Object.entries(state).map(([platform, { date, time }]) => {
        const [hours, minutes] = time.split(':').map(Number)
        const dt = setMinutes(setHours(date, hours), minutes)
        return [
          platform,
          { scheduled_at: dt.toISOString(), published_at: null },
        ]
      }),
    )
  }

  function handlePerPlatformToggle(checked) {
    if (checked) {
      const currentDate = form.getValues('target_date')
      const initialState = {}
      watchedPlatforms.forEach((p) => {
        initialState[p] = {
          date: currentDate || null,
          time: currentDate ? format(currentDate, 'HH:mm') : '09:00',
        }
      })
      setPlatformSchedulesState(initialState)
      setPerPlatformMode(true)
    } else {
      setPlatformSchedulesState({})
      setPerPlatformMode(false)
    }
  }

  const { data: client, isLoading: isClientLoading } = useQuery({
    queryKey: ['client', effectiveClientId],
    queryFn: () => fetchClientById(effectiveClientId),
    enabled: !!effectiveClientId && open,
  })

  const availablePlatforms = client?.platforms || []

  // Custom Submit Handler to enforce Youtube Constraint
  const onSubmit = (values) => {
    if (!effectiveClientId) {
      form.setError('client_id', {
        type: 'manual',
        message: 'Please select a target client.',
      })
      return
    }

    if (values.platforms.includes('youtube') && !hasVideo) {
      form.setError('platforms', {
        type: 'manual',
        message:
          'YouTube requires a video file. Please upload a video or deselect YouTube.',
      })
      return
    }

    if (perPlatformMode) {
      const incomplete = watchedPlatforms.filter(
        (p) =>
          !platformSchedulesState[p]?.date || !platformSchedulesState[p]?.time,
      )
      if (incomplete.length > 0) {
        toast.error('Please set a date and time for all selected platforms.')
        return
      }
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
        uploadPostImage({ file, clientId: effectiveClientId }),
      )
      const newMediaUrls = await Promise.all(uploadPromises)

      const existingRemoteUrls = previews
        .filter((p) => p.url.startsWith('http'))
        .map((p) => p.url)

      const finalMediaUrls = [...existingRemoteUrls, ...newMediaUrls]

      const payload = {
        clientId: effectiveClientId,
        title: values.title,
        content: values.content,
        mediaUrls: finalMediaUrls,
        platforms: values.platforms,
        target_date: values.target_date?.toISOString(),
        userId: user?.id,
        adminNotes: values.admin_notes || null,
        platformSchedules: perPlatformMode
          ? buildPlatformSchedulesPayload(platformSchedulesState)
          : null,
        campaignId: values.campaign_id || null,
      }

      if (isEditMode)
        return updatePost(initialData.version_id, {
          ...payload,
          postId: initialData.actual_post_id,
        })
      return createDraftPost(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['draft-posts', effectiveClientId],
      })
      queryClient.invalidateQueries({ queryKey: ['posts', effectiveClientId] })
      queryClient.invalidateQueries({ queryKey: ['global-posts'] })
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
    setPerPlatformMode(false)
    setPlatformSchedulesState({})
    onOpenChange(false)
  }

  const processFiles = (fileList) => {
    let files = Array.from(fileList)

    if (isYoutubeSelected) {
      const videoFiles = files.filter((f) => f.type.startsWith('video/'))
      if (videoFiles.length < files.length) {
        toast.error('Only video files are allowed when YouTube is selected.')
      }
      files = videoFiles
      if (files.length > 1) {
        toast.warning('YouTube allows only one video. Taking the first one.')
        files = files.slice(0, 1)
      }
    }

    const currentFiles = form.getValues('images') || []
    const maxAllowed = isYoutubeSelected ? 1 : MAX_FILES
    const remainingSlots = maxAllowed - previews.length

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

  const handleFileChange = (e) => {
    processFiles(e.target.files || [])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (isStorageFull) return
    processFiles(e.dataTransfer.files)
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
      <DialogContent className="sm:max-w-none w-[70vw] max-h-[80vh] h-[80vh] flex flex-col p-0 overflow-hidden">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 min-h-0"
          >
            {/* ===== LEFT PANEL: Add Media ===== */}
            <div className="w-[50%] shrink-0 border-r flex flex-col p-8 gap-6 overflow-y-auto bg-muted/20">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold tracking-tight">
                  Add Media
                </h2>
                {isStorageFull && (
                  <Badge
                    variant="destructive"
                    className="text-[10px] animate-pulse"
                  >
                    Storage Full
                  </Badge>
                )}
              </div>

              {/* Drop Zone */}
              <div
                className={cn(
                  'flex-1 min-h-[200px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 p-10 cursor-pointer transition-all',
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40 hover:bg-accent/40',
                  previews.length >= (isYoutubeSelected ? 1 : MAX_FILES) &&
                    'pointer-events-none opacity-40',
                  isStorageFull && 'pointer-events-none opacity-40',
                )}
                onClick={() => {
                  if (
                    isStorageFull ||
                    previews.length >= (isYoutubeSelected ? 1 : MAX_FILES)
                  )
                    return
                  fileInputRef.current?.click()
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (
                    !isStorageFull &&
                    previews.length < (isYoutubeSelected ? 1 : MAX_FILES)
                  )
                    setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <div className="rounded-full border bg-background p-4 shadow-sm">
                  <Upload className="h-7 w-7 text-muted-foreground" />
                </div>
                <div className="text-center space-y-1.5">
                  <p className="text-sm font-medium text-foreground">
                    {previews.length >= (isYoutubeSelected ? 1 : MAX_FILES)
                      ? isYoutubeSelected
                        ? 'YouTube allows only 1 video.'
                        : `Maximum ${MAX_FILES} files reached.`
                      : 'Drop a file here or click to browse'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Max {isYoutubeSelected ? '1 video' : `${MAX_FILES} files`}
                  </p>
                  <p className="text-[11px] text-muted-foreground/70">
                    {isYoutubeSelected
                      ? 'MP4, MOV, WEBM, M4V'
                      : 'JPG, PNG, GIF, WEBP, MP4, MOV, WEBM'}
                  </p>
                </div>
                {previews.length < (isYoutubeSelected ? 1 : MAX_FILES) &&
                  !isStorageFull && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        fileInputRef.current?.click()
                      }}
                    >
                      Choose File
                    </Button>
                  )}
              </div>

              {isYoutubeSelected && (
                <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1.5">
                  <AlertCircle size={12} className="shrink-0" />
                  YouTube: Single video upload only.
                </p>
              )}

              {/* Uploaded Media */}
              {previews.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Uploaded Media</p>
                  <div className="grid grid-cols-3 gap-3">
                    {previews.map((item, index) => (
                      <div
                        key={item.url}
                        className="relative aspect-square rounded-xl border overflow-hidden bg-muted shadow-sm"
                      >
                        {item.type === 'video' ? (
                          <div className="relative h-full w-full">
                            <video
                              src={item.url}
                              className="h-full w-full object-cover"
                              muted
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                              <Film className="h-6 w-6 text-white" />
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
                          className="absolute top-1.5 right-1.5 bg-background/90 p-0.5 rounded-full border shadow-sm hover:bg-destructive hover:text-white transition-all"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <input
                type="file"
                multiple={!isYoutubeSelected}
                accept={isYoutubeSelected ? 'video/*' : 'image/*,video/*'}
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>

            {/* ===== RIGHT PANEL: Form ===== */}
            <div className="flex-1 flex flex-col min-h-0">
              <DialogHeader className="px-8 py-6 shrink-0 border-b gap-1">
                <DialogTitle className="text-lg">
                  {isEditMode ? 'Edit Draft Post' : 'Create a Post'}
                </DialogTitle>
                {!isEditMode && (
                  <p className="text-sm text-muted-foreground">
                    This post will be saved as a draft at version 1.0 for review and scheduling.
                  </p>
                )}
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
                {/* Client Select */}
                {!clientId && availableClients.length > 0 && (
                  <FormField
                    control={form.control}
                    name="client_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Target Client{' '}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a client for this post" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableClients.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                <div className="flex items-center gap-2">
                                  {c.logo_url ? (
                                    <img
                                      src={c.logo_url}
                                      alt=""
                                      className="size-4 rounded-sm object-cover"
                                    />
                                  ) : (
                                    <div className="size-4 rounded-sm bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground uppercase">
                                      {c.name?.[0]}
                                    </div>
                                  )}
                                  <span>{c.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Campaign Select — only when active campaigns exist for this client */}
                {availableCampaigns.length > 0 && (
                  <FormField
                    control={form.control}
                    name="campaign_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campaign</FormLabel>
                        <Select
                          onValueChange={(val) => field.onChange(val === 'none' ? '' : val)}
                          value={field.value || 'none'}
                          disabled={!!initialCampaignId}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="No Campaign" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No Campaign</SelectItem>
                            {/* Ensure we have at least one entry for the pre-selected campaign even if it's not in the active list fetched */}
                            {initialCampaignId && initialCampaignName && !availableCampaigns.some(c => c.id === initialCampaignId) && (
                              <SelectItem key={initialCampaignId} value={initialCampaignId}>
                                {initialCampaignName}
                              </SelectItem>
                            )}
                            {availableCampaigns.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Platform Select */}
                <FormField
                  control={form.control}
                  name="platforms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Target Platforms{' '}
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {!effectiveClientId ? (
                          <p className="text-xs text-muted-foreground italic">
                            Select a client to see platforms
                          </p>
                        ) : isClientLoading ? (
                          <Skeleton className="h-8 w-32" />
                        ) : (
                          Object.entries(PLATFORM_CONFIG)
                            .filter(([id]) => availablePlatforms.includes(id))
                            .map(([id, config]) => {
                              const isSelected = field.value?.includes(id)
                              let isDisabled = false
                              let tooltipText = ''
                              if (id === 'youtube' && hasMedia && !hasVideo) {
                                isDisabled = true
                                tooltipText = 'YouTube requires a video file.'
                              }

                              const badge = (
                                <label
                                  key={id}
                                  className={cn(
                                    'cursor-pointer',
                                    isDisabled &&
                                      'cursor-not-allowed opacity-40',
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
                                      if (id === 'youtube' && isChecking) {
                                        if (previews.length > 1) {
                                          toast.error(
                                            'YouTube posts are limited to 1 video file. Please remove other files first.',
                                          )
                                          return
                                        }
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
                                  <span
                                    className={cn(
                                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all select-none',
                                      isSelected
                                        ? config.selected
                                        : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                                    )}
                                  >
                                    <img
                                      src={config.logo}
                                      alt={config.label}
                                      className="h-3.5 w-3.5 shrink-0 object-contain"
                                    />
                                    {config.label}
                                  </span>
                                </label>
                              )

                              if (isDisabled) {
                                return (
                                  <TooltipProvider key={id}>
                                    <Tooltip delayDuration={0}>
                                      <TooltipTrigger asChild>
                                        <div>{badge}</div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{tooltipText}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )
                              }
                              return badge
                            })
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Single date/time — hidden in per-platform mode */}
                {!perPlatformMode && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="target_date"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>
                            Proposed Schedule date{' '}
                            <span className="text-destructive">*</span>
                          </FormLabel>
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
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date <
                                  new Date(new Date().setHours(0, 0, 0, 0))
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormItem className="flex flex-col">
                      <FormLabel>
                        Time <span className="text-destructive">*</span>
                      </FormLabel>
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
                )}

                {/* Per-platform toggle */}
                {watchedPlatforms.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="per-platform-mode"
                      checked={perPlatformMode}
                      onCheckedChange={handlePerPlatformToggle}
                    />
                    <label
                      htmlFor="per-platform-mode"
                      className="text-sm text-muted-foreground cursor-pointer select-none"
                    >
                      Schedule each platform separately
                    </label>
                  </div>
                )}

                {/* Per-platform schedule rows */}
                {perPlatformMode && watchedPlatforms.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Per-Platform Schedule
                    </p>
                    {watchedPlatforms.map((platformId) => {
                      const config = PLATFORM_CONFIG[platformId]
                      if (!config) return null
                      const sched = platformSchedulesState[platformId] || {
                        date: null,
                        time: '09:00',
                      }
                      return (
                        <div
                          key={platformId}
                          className="flex items-center gap-2"
                        >
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(
                                  'flex-1 justify-start gap-2 font-normal h-10 text-sm',
                                  !sched.date && 'text-muted-foreground',
                                )}
                              >
                                <img
                                  src={config.logo}
                                  alt={config.label}
                                  className="h-3.5 w-3.5 shrink-0 object-contain"
                                />
                                <span className="flex-1 text-left">
                                  {sched.date
                                    ? format(sched.date, 'PPP')
                                    : 'Pick a date'}
                                </span>
                                <CalendarIcon className="h-3.5 w-3.5 opacity-40 shrink-0" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={sched.date}
                                onSelect={(date) =>
                                  setPlatformSchedulesState((prev) => ({
                                    ...prev,
                                    [platformId]: {
                                      ...prev[platformId],
                                      date,
                                    },
                                  }))
                                }
                                disabled={(date) =>
                                  date <
                                  new Date(new Date().setHours(0, 0, 0, 0))
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <Select
                            value={sched.time || '09:00'}
                            onValueChange={(val) =>
                              setPlatformSchedulesState((prev) => ({
                                ...prev,
                                [platformId]: {
                                  ...prev[platformId],
                                  time: val,
                                },
                              }))
                            }
                          >
                            <SelectTrigger className="w-28 h-10">
                              <SelectValue placeholder="Time" />
                            </SelectTrigger>
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
                        </div>
                      )
                    })}
                    {form.watch('target_date') && (
                      <p className="text-xs text-muted-foreground pt-1">
                        Target date auto-set to{' '}
                        <span className="font-medium text-foreground">
                          {format(form.watch('target_date'), 'PPP')}
                        </span>{' '}
                        (earliest)
                      </p>
                    )}
                  </div>
                )}

                {/* Title */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Title <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Enter post title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Caption */}
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Caption <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Write your post content..."
                          className="resize-none"
                          rows={5}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="px-8 py-5 bg-background border-t shrink-0">
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
              </DialogFooter>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
