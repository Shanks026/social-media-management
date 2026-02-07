import { useState, useEffect, useRef } from 'react'
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  Play,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AspectRatio } from '@/components/ui/aspect-ratio'

const isVideoSource = (url) => {
  if (!url) return false
  const videoExtensions = ['.mp4', '.mov', '.webm', '.ogg', '.m4v']
  return (
    videoExtensions.some((ext) => url.toLowerCase().includes(ext)) ||
    url.includes('video')
  )
}

export default function InstagramPreview({ post }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [aspectRatio, setAspectRatio] = useState(1 / 1) // Default to square
  const videoRef = useRef(null)

  const mediaUrls = post?.media_urls || []
  const hasMultipleMedia = mediaUrls.length > 1
  const content = post?.content || ''
  const currentMedia = mediaUrls[currentSlide]

  // Dynamic Aspect Ratio Calculation
  useEffect(() => {
    if (!currentMedia) return

    if (isVideoSource(currentMedia)) {
      // For videos, the ratio is calculated once metadata is loaded
      const video = document.createElement('video')
      video.src = currentMedia
      video.onloadedmetadata = () => {
        setAspectRatio(video.videoWidth / video.videoHeight)
      }
    } else {
      // For images, calculate ratio from natural dimensions
      const img = new Image()
      img.src = currentMedia
      img.onload = () => {
        setAspectRatio(img.naturalWidth / img.naturalHeight)
      }
    }
  }, [currentMedia])

  const handleNext = (e) => {
    e.stopPropagation()
    setCurrentSlide((prev) => (prev === mediaUrls.length - 1 ? 0 : prev + 1))
  }

  const handlePrev = (e) => {
    e.stopPropagation()
    setCurrentSlide((prev) => (prev === 0 ? mediaUrls.length - 1 : prev - 1))
  }

  return (
    <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-4xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950 transition-colors duration-200">
      {/* 1. Header */}
      <div className="flex items-center justify-between p-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 p-[1.5px]">
            <div className="h-full w-full rounded-full border-2 border-white bg-zinc-200 dark:border-zinc-950 dark:bg-zinc-800" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
                username
              </span>
              <BadgeCheck
                size={14}
                className="fill-blue-500 text-white dark:text-zinc-950"
              />
            </div>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Location Here
            </span>
          </div>
        </div>
        <MoreHorizontal size={18} className="text-zinc-400" />
      </div>

      {/* 2. Media Area with Dynamic AspectRatio */}
      <div className="relative w-full bg-zinc-50 dark:bg-zinc-900/50 group">
        <AspectRatio ratio={aspectRatio}>
          {mediaUrls.length > 0 ? (
            <div className="h-full w-full">
              {isVideoSource(currentMedia) ? (
                <video
                  key={currentMedia}
                  src={currentMedia}
                  className="h-full w-full object-contain bg-black"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <img
                  src={currentMedia}
                  alt="Post content"
                  className="h-full w-full object-contain"
                />
              )}
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-xs text-zinc-400 font-medium italic">
                No media selected
              </span>
            </div>
          )}
        </AspectRatio>

        {/* Carousel Controls */}
        {hasMultipleMedia && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity dark:bg-zinc-900/80"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity dark:bg-zinc-900/80"
            >
              <ChevronRight size={18} />
            </button>
            <div className="absolute top-4 right-4 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
              {currentSlide + 1}/{mediaUrls.length}
            </div>
          </>
        )}
      </div>

      {/* 3. Interaction Bar */}
      <div className="space-y-2.5 p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-zinc-900 dark:text-zinc-100">
            <Heart
              size={24}
              onClick={() => setIsLiked(!isLiked)}
              className={cn(
                'cursor-pointer transition-all active:scale-125',
                isLiked ? 'fill-red-500 text-red-500' : 'hover:opacity-60',
              )}
            />
            <MessageCircle
              size={24}
              className="hover:opacity-60 cursor-pointer"
            />
            <Send size={24} className="hover:opacity-60 cursor-pointer" />
          </div>

          {/* Pagination Dots */}
          {hasMultipleMedia && (
            <div className="flex gap-1 absolute left-1/2 -translate-x-1/2">
              {mediaUrls.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1.5 w-1.5 rounded-full transition-all',
                    currentSlide === i
                      ? 'bg-blue-500'
                      : 'bg-zinc-300 dark:bg-zinc-700',
                  )}
                />
              ))}
            </div>
          )}

          <Bookmark
            size={24}
            className="text-zinc-900 dark:text-zinc-100 hover:opacity-60 cursor-pointer"
          />
        </div>

        <p className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
          {isLiked ? '1,241' : '1,240'} likes
        </p>

        {/* 4. Caption: Username + Content inline */}
        <div className="text-[13px] leading-[1.4] text-zinc-900 dark:text-zinc-100">
          <div className={cn(!isExpanded && 'line-clamp-2')}>
            <span className="font-bold mr-1.5 cursor-pointer">username</span>
            <span className="text-zinc-800 dark:text-zinc-300">
              {content || 'No caption provided.'}
            </span>
          </div>

          {content.length > 50 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1 text-zinc-500 dark:text-zinc-400 font-medium hover:text-zinc-700 block"
            >
              {isExpanded ? '... less' : '... more'}
            </button>
          )}
        </div>

        <p className="text-[13px] text-zinc-400 dark:text-zinc-500 cursor-pointer">
          View all 12 comments
        </p>
      </div>
    </div>
  )
}
