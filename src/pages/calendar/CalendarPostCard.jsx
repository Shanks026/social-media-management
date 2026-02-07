import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import {
  Clock,
  Layers,
  Instagram,
  Linkedin,
  Twitter,
  Facebook,
  Youtube,
  Globe,
  Play,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import StatusBadge from '@/components/StatusBadge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useNavigate } from 'react-router-dom'

/**
 * Helper to check if a URL is a video
 */
const isVideoSource = (url) => {
  if (!url) return false
  const videoExtensions = ['.mp4', '.mov', '.webm', '.ogg', '.m4v']
  return (
    videoExtensions.some((ext) => url.toLowerCase().includes(ext)) ||
    url.includes('video') ||
    url.startsWith('blob:')
  )
}

/**
 * Reusable Media Item to handle Video vs Image rendering
 */
const MediaItem = ({ url, className, isPreview = false }) => {
  const isVideo = isVideoSource(url)

  if (isVideo) {
    return (
      <div className={cn('relative h-full w-full bg-black', className)}>
        <video
          src={url}
          className="h-full w-full object-cover"
          muted={!isPreview}
          controls={isPreview}
          autoPlay={isPreview}
          loop={!isPreview}
          playsInline
        />
        {!isPreview && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
            <div className="bg-white/20 backdrop-blur-md p-1.5 rounded-full">
              <Play className="text-white h-4 w-4 fill-current" />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <img
      src={url}
      alt="Media"
      className={cn('h-full w-full object-cover', className)}
    />
  )
}

// Platform Icon Helper
const PlatformIcon = ({ name }) => {
  const icons = {
    instagram: {
      icon: <Instagram className="size-3 text-white" />,
      bg: 'bg-[#E4405F]',
    },
    linkedin: {
      icon: <Linkedin className="size-3 text-white" />,
      bg: 'bg-[#0077B5]',
    },
    twitter: {
      icon: <Twitter className="size-3 text-white dark:text-black" />,
      bg: 'bg-black dark:bg-white',
    },
    facebook: {
      icon: <Facebook className="size-3 text-white" />,
      bg: 'bg-[#1877F2]',
    },
    youtube: {
      icon: <Youtube className="size-3 text-white" />,
      bg: 'bg-[#FF0000]',
    },
    google_business: {
      icon: <Globe className="size-3 text-white" />,
      bg: 'bg-[#4285F4]',
    },
  }
  const platform = icons[name.toLowerCase()]
  if (!platform) return null
  return (
    <div
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-full border-2 border-background shadow-sm shrink-0',
        platform.bg,
      )}
    >
      {platform.icon}
    </div>
  )
}

export function CalendarPostCard({ post }) {
  const navigate = useNavigate()
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  const handleCardClick = () => {
    navigate(`/clients/${post.client_id}/posts/${post.version_id}`)
  }

  if (!post) return null

  const handlePrev = (e) => {
    e?.stopPropagation()
    setActiveImageIndex((prev) =>
      prev === 0 ? post.media_urls.length - 1 : prev - 1,
    )
  }

  const handleNext = (e) => {
    e?.stopPropagation()
    setActiveImageIndex((prev) =>
      prev === post.media_urls.length - 1 ? 0 : prev + 1,
    )
  }

  const renderMediaGrid = () => {
    const media = post.media_urls || []
    const count = media.length
    if (count === 0) {
      return (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/10 font-black text-3xl uppercase tracking-tighter select-none">
          No Media
        </div>
      )
    }

    if (count === 1) return <MediaItem url={media[0]} />

    if (count === 2)
      return (
        <div className="grid grid-cols-2 gap-0.5 w-full h-full">
          {media.map((url, i) => (
            <MediaItem key={i} url={url} />
          ))}
        </div>
      )

    return (
      <div className="grid grid-cols-2 gap-0.5 w-full h-full">
        <MediaItem url={media[0]} />
        <div className="grid grid-rows-2 gap-0.5 h-full overflow-hidden">
          <MediaItem url={media[1]} />
          <div className="relative h-full w-full">
            <MediaItem url={media[2]} />
            {count > 3 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
                <span className="text-white font-bold text-sm">
                  +{count - 3}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* 1. The Main Clickable Card */}
      <div
        onClick={handleCardClick}
        className="flex flex-col bg-card border rounded-xl overflow-hidden hover:bg-muted/30 transition-colors duration-200 cursor-pointer"
      >
        {/* Media Preview Section */}
        <div
          className="relative aspect-video bg-muted overflow-hidden shrink-0 group/media cursor-pointer"
          onClick={(e) => {
            e.stopPropagation() // Prevents CardClick when clicking to open preview
            setIsPreviewOpen(true)
          }}
        >
          {renderMediaGrid()}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center">
            <div className="bg-white/20 backdrop-blur-md p-2 rounded-full shadow-sm">
              <Eye className="text-white h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="p-6 flex flex-col flex-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={post.client_logo}
                alt=""
                className="size-5 rounded-lg object-cover ring-1 ring-border"
              />
              <span className="text-xs font-semibold text-foreground truncate">
                {post.client_name}
              </span>
            </div>
            <StatusBadge status={post.status} />
          </div>

          <div className="mb-6 space-y-2">
            <h4 className="text-lg font-semibold tracking-tight leading-tight text-foreground line-clamp-1">
              {post.title}
            </h4>
            <p className="text-sm font-medium text-muted-foreground leading-[1.6] line-clamp-2">
              {post.content}
            </p>
          </div>

          <div className="flex items-center justify-between mt-auto pt-5 border-t border-border/50">
            <div className="flex items-center -space-x-2">
              {post.platforms.map((p) => (
                <PlatformIcon key={p} name={p} />
              ))}
            </div>

            <div className="flex items-center gap-4 text-foreground">
              <div className="flex items-center gap-1.5">
                <Clock size={14} />
                <span className="text-xs font-semibold">
                  {format(new Date(post.target_date), 'p')}
                </span>
              </div>

              <Badge variant="secondary" className="text-xs">
                <Layers size={10} className="me-1" />v{post.version_number}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* 2. The Dialog: Sibling to the Card, NOT a child */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent
          className="max-w-[90vw] lg:max-w-[1100px] h-[85vh] p-0 bg-transparent border-none shadow-none flex items-center justify-center overflow-hidden"
          onClick={(e) => e.stopPropagation()} // Extra safety for the content area
        >
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative w-full h-full overflow-hidden rounded-3xl bg-black/95 flex items-center justify-center border border-white/10">
              <div className="w-full h-full flex items-center justify-center">
                {post.media_urls && post.media_urls.length > 0 && (
                  <MediaItem
                    url={post.media_urls[activeImageIndex]}
                    className="object-contain"
                    isPreview={true}
                  />
                )}
              </div>

              {post.media_urls?.length > 1 && (
                <>
                  <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none z-50">
                    <button
                      onClick={handlePrev}
                      className="pointer-events-auto p-4 rounded-2xl bg-black/40 text-white hover:bg-black/60 backdrop-blur-xl transition-all"
                    >
                      <ChevronLeft className="h-8 w-8" />
                    </button>
                    <button
                      onClick={handleNext}
                      className="pointer-events-auto p-4 rounded-2xl bg-black/40 text-white hover:bg-black/60 backdrop-blur-xl transition-all"
                    >
                      <ChevronRight className="h-8 w-8" />
                    </button>
                  </div>
                  <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50">
                    <Badge className="bg-white/10 text-white border-none backdrop-blur-md px-4 py-1.5 font-mono">
                      {activeImageIndex + 1} / {post.media_urls.length}
                    </Badge>
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
