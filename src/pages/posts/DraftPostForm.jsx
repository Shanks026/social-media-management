import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
} from 'lucide-react'

import { createDraftPost, updatePost } from '@/api/posts'
import { uploadPostImage } from '@/api/storage'

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
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

const MAX_FILES = 5

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
  google_ads: {
    label: 'Google Ads',
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
}

// Updated Schema to include all platforms
const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Post content is required'),
  platforms: z.array(z.string()).min(1, 'Select at least one platform'), // Changed to array
  images: z.array(z.any()).max(MAX_FILES).default([]),
})

export default function DraftPostForm({
  clientId,
  open,
  onOpenChange,
  initialData = null,
}) {
  const queryClient = useQueryClient()
  const isEditMode = !!initialData

  const [previews, setPreviews] = useState([])
  const fileInputRef = useRef(null)

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      content: '',
      platforms: [], // Default as empty array
      images: [],
    },
  })

  useEffect(() => {
    if (initialData && open) {
      // Logic to handle if initialData.platform is a string or already an array
      const platformData = Array.isArray(initialData.platform)
        ? initialData.platform
        : [initialData.platform].filter(Boolean)

      form.reset({
        title: initialData.title || '',
        content: initialData.content || '',
        platforms: platformData.map((p) => p.toLowerCase().replace(' ', '_')),
        images: [],
      })
      setPreviews(initialData.media_urls || [])
    }
  }, [initialData, open, form])

  const mutation = useMutation({
    mutationFn: async (values) => {
      const uploadPromises = values.images.map((file) =>
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
      }

      if (isEditMode) {
        return updatePost(initialData.id, payload)
      }
      return createDraftPost(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft-posts', clientId] })
      toast.success(isEditMode ? 'Post updated' : 'Draft created')
      resetAndClose()
    },
    onError: () => {
      toast.error('Something went wrong')
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
                <FormLabel>
                  Media Assets ({previews.length}/{MAX_FILES})
                </FormLabel>
                <div className="grid grid-cols-5 gap-4">
                  {previews.map((url, index) => (
                    <div
                      key={url}
                      className="relative aspect-square rounded-lg border overflow-hidden bg-muted shadow-sm"
                    >
                      <img
                        src={url}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
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
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed hover:bg-accent hover:border-primary/50 transition-all"
                    >
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <Plus className="h-6 w-6" />
                        <span className="text-[10px] font-bold uppercase">
                          Add
                        </span>
                      </div>
                    </button>
                  )}
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </div>

              {/* Updated Platform Select */}
              <FormField
                control={form.control}
                name="platforms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">
                      Target Platforms
                    </FormLabel>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {Object.entries(PLATFORM_CONFIG).map(([id, config]) => {
                        const Icon = config.icon
                        const isSelected = field.value?.includes(id)

                        return (
                          <label
                            key={id}
                            className="cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={isSelected}
                              onChange={(e) => {
                                const currentValues = field.value || []
                                if (e.target.checked) {
                                  field.onChange([...currentValues, id])
                                } else {
                                  field.onChange(
                                    currentValues.filter((v) => v !== id),
                                  )
                                }
                              }}
                            />
                            <Badge
                              variant="outline"
                              className={cn(
                                'flex items-center gap-2 px-3 py-1.5 rounded-sm transition-all duration-200 border-transparent',
                                'bg-secondary/40 text-muted-foreground hover:bg-secondary/60 dark:bg-muted/20', // Inactive State
                                isSelected && config.active, // Active State from your config
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
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Title Field */}
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

              {/* Caption Field */}
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Caption</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Write your post content..."
                        className="min-h-[120px] resize-none"
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
