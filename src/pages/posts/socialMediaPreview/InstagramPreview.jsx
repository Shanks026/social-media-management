import { useState, useEffect, useRef } from 'react'
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Music2,
  Camera,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AspectRatio } from '@/components/ui/aspect-ratio'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

/**
 * Enhanced Text Parser
 * Colors #hashtags and @mentions in Instagram's specific blue.
 */
const renderParsedContent = (text) => {
  if (!text) return null
  return text.split(/(\s+)/).map((part, i) => {
    if (part.startsWith('#') || part.startsWith('@')) {
      return (
        <span
          key={i}
          className="text-[#00376b] dark:text-[#e0f1ff] cursor-pointer hover:opacity-70"
        >
          {part}
        </span>
      )
    }
    return part
  })
}

const isVideoSource = (url) => {
  if (!url) return false
  const videoExtensions = ['.mp4', '.mov', '.webm', '.ogg', '.m4v']
  return (
    videoExtensions.some((ext) => url.toLowerCase().includes(ext)) ||
    url.includes('video')
  )
}

export default function InstagramPreview({ post, client }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [aspectRatio, setAspectRatio] = useState(1 / 1)
  const [isReel, setIsReel] = useState(false)
  const touchStartX = useRef(null)

  const mediaUrls = post?.media_urls || []
  const content = post?.content || ''
  const slideCount = mediaUrls.length
  const safeSlide = Math.min(currentSlide, Math.max(0, slideCount - 1))
  const safeCurrent = mediaUrls[safeSlide]

  const handle = client?.social_links?.instagram?.handle || 'username'
  const logo = client?.logo_url
  const location = client?.industry || 'Location'

  useEffect(() => {
    if (!safeCurrent) return

    if (isVideoSource(safeCurrent)) {
      const video = document.createElement('video')
      video.src = safeCurrent
      video.onloadedmetadata = () => {
        const ratio = video.videoWidth / video.videoHeight
        setAspectRatio(ratio)
        if (ratio < 0.8) setIsReel(true)
        else setIsReel(false)
      }
    } else {
      const img = new Image()
      img.src = safeCurrent
      img.onload = () => {
        setAspectRatio(img.naturalWidth / img.naturalHeight)
        setIsReel(false)
      }
    }
  }, [safeCurrent])

  const goPrev = (e) => {
    e?.stopPropagation()
    setCurrentSlide((s) => (s === 0 ? slideCount - 1 : s - 1))
  }

  const goNext = (e) => {
    e?.stopPropagation()
    setCurrentSlide((s) => (s === slideCount - 1 ? 0 : s + 1))
  }

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
  }

  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const delta = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(delta) > 40) delta > 0 ? goNext() : goPrev()
    touchStartX.current = null
  }

  const toggleLike = (e) => {
    e.stopPropagation()
    setIsLiked(!isLiked)
  }

  return (
    <div className="flex flex-col items-center w-full max-w-[400px] mx-auto gap-4">
      {/* View Mode Toggle */}
      <div className="flex items-center justify-end w-full space-x-2 px-2">
        <Label
          htmlFor="mode"
          className={cn(
            'text-xs font-medium transition-colors',
            !isReel ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          Post
        </Label>
        <Switch
          id="mode"
          checked={isReel}
          onCheckedChange={setIsReel}
          disabled={!isVideoSource(safeCurrent)}
        />
        <Label
          htmlFor="mode"
          className={cn(
            'text-xs font-medium transition-colors',
            isReel ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          Reel
        </Label>
      </div>

      {isReel ? (
        /* --- SLEEK REEL UI --- */
        <div className="relative w-full aspect-[9/16] bg-black rounded-[2.5rem] overflow-hidden border border-zinc-200 dark:border-zinc-800">
          {safeCurrent && (
            <video
              src={safeCurrent}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/50 pointer-events-none" />

          {/* Top Bar */}
          <div className="absolute top-8 left-6 right-6 flex justify-between items-center text-white z-20">
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="font-bold text-sm tracking-tight">Reels</span>
            <Camera size={24} strokeWidth={2.5} />
          </div>

          {/* Right Action Bar */}
          <div className="absolute right-3 bottom-20 flex flex-col items-center gap-5 text-white z-20">
            <div
              className="flex flex-col items-center gap-1 cursor-pointer"
              onClick={toggleLike}
            >
              <Heart
                size={28}
                strokeWidth={2.5}
                className={cn(
                  'transition-all duration-200',
                  isLiked
                    ? 'fill-[#ed4956] text-[#ed4956] scale-110'
                    : 'text-white active:scale-125',
                )}
              />
              <span className="text-[10px] font-semibold tracking-wide">
                120K
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <MessageCircle size={28} strokeWidth={2.5} />
              <span className="text-[10px] font-semibold">452</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Send size={26} strokeWidth={2.5} className="-rotate-12" />
              <span className="text-[10px] font-semibold">25K</span>
            </div>
            <MoreHorizontal size={24} strokeWidth={2.5} />
            <div className="size-7 rounded-lg border-2 border-white overflow-hidden mt-2 bg-zinc-800 relative">
              {logo && (
                <img src={logo} className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <Music2 size={10} className="text-white fill-current" />
              </div>
            </div>
          </div>

          {/* Bottom Attribution */}
          <div className="absolute left-4 bottom-8 right-16 text-white z-20">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-8 rounded-full bg-zinc-700 overflow-hidden border border-white/20 shrink-0">
                {logo ? (
                  <img src={logo} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-[10px] font-bold p-2">
                    {(handle || 'U').slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="font-bold text-[13px]">{handle}</span>
              <button className="border border-white/40 px-2.5 py-0.5 rounded-lg text-[10px] font-bold hover:bg-white/10 transition-colors">
                Follow
              </button>
            </div>
            <div className="mb-3">
              <div
                className={cn(
                  'text-[13px] leading-snug',
                  !isExpanded ? 'line-clamp-1' : 'line-clamp-none',
                )}
              >
                <span className="font-bold mr-1.5">{handle}</span>
                <span className="opacity-90">
                  {renderParsedContent(content) || 'Your reel description...'}
                </span>
              </div>
              {content.length > 40 && !isExpanded && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsExpanded(true)
                  }}
                  className="text-[13px] font-bold opacity-70 mt-0.5"
                >
                  more
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] bg-black/20 backdrop-blur-md py-1 px-3 rounded-full w-fit max-w-full">
              <Music2 size={10} className="shrink-0" />
              <span className="truncate">Original audio • {handle}</span>
            </div>
          </div>
        </div>
      ) : (
        /* --- REFINED FEED POST UI --- */
        <div className="w-full bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-full bg-zinc-100 overflow-hidden border border-zinc-200 dark:border-zinc-800">
                {logo ? (
                  <img src={logo} className="w-full h-full object-cover" />
                ) : (
                  <div className="size-full flex items-center justify-center text-[10px] font-bold text-zinc-400">
                    {handle.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-bold leading-none truncate">
                  {handle}
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {location}
                </span>
              </div>
            </div>
            <MoreHorizontal size={18} className="text-muted-foreground" />
          </div>

          {/* Media Area */}
          <div
            className="relative w-full bg-zinc-50 dark:bg-zinc-900 overflow-hidden"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <AspectRatio ratio={aspectRatio}>
              {safeCurrent ? (
                isVideoSource(safeCurrent) ? (
                  <video
                    src={safeCurrent}
                    className="w-full h-full object-contain bg-black"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                ) : (
                  <img
                    src={safeCurrent}
                    alt="Post"
                    className="w-full h-full object-contain"
                  />
                )
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground italic text-xs">
                  No media selected
                </div>
              )}

              {/* Carousel arrows */}
              {slideCount > 1 && (
                <>
                  <button
                    onClick={goPrev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/80 dark:bg-black/60 rounded-full p-1 shadow hover:bg-white transition-colors"
                  >
                    <ChevronLeft size={16} className="text-zinc-800 dark:text-zinc-200" />
                  </button>
                  <button
                    onClick={goNext}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/80 dark:bg-black/60 rounded-full p-1 shadow hover:bg-white transition-colors"
                  >
                    <ChevronRight size={16} className="text-zinc-800 dark:text-zinc-200" />
                  </button>

                  {/* Dot indicators */}
                  <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10">
                    {mediaUrls.map((_, i) => (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); setCurrentSlide(i) }}
                        className={cn(
                          'rounded-full transition-all duration-200',
                          i === safeSlide
                            ? 'bg-[#0095f6] w-1.5 h-1.5'
                            : 'bg-white/70 w-1 h-1'
                        )}
                      />
                    ))}
                  </div>

                  {/* Slide counter */}
                  <div className="absolute top-2.5 right-2.5 z-10 bg-black/40 backdrop-blur-sm text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                    {safeSlide + 1}/{slideCount}
                  </div>
                </>
              )}
            </AspectRatio>
          </div>

          {/* Interaction Bar */}
          <div className="p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Heart
                  size={24}
                  onClick={toggleLike}
                  className={cn(
                    'cursor-pointer transition-all duration-200 scale-110',
                    isLiked
                      ? 'fill-[#ed4956] text-[#ed4956]'
                      : 'hover:opacity-60',
                  )}
                />
                <MessageCircle
                  size={24}
                  className="hover:opacity-60 cursor-pointer"
                />
                <Send size={24} className="hover:opacity-60 cursor-pointer" />
              </div>
              <Bookmark size={24} className="hover:opacity-60 cursor-pointer" />
            </div>

            <p className="text-[13px] font-bold">
              {isLiked ? '1,241' : '1,240'} likes
            </p>

            {/* 🛠️ ALIGNED DESCRIPTION NEXT TO USERNAME */}
            <div className="text-[13px] leading-[1.4]">
              <div className={cn('inline', !isExpanded && 'line-clamp-2')}>
                <span className="font-bold mr-1.5 cursor-pointer hover:opacity-70 inline">
                  {handle}
                </span>
                <span className="text-zinc-800 dark:text-zinc-300 inline">
                  {renderParsedContent(content) || 'No caption provided.'}
                </span>
                {content.length > 50 && !isExpanded && (
                  <button
                    onClick={() => setIsExpanded(true)}
                    className="text-muted-foreground font-medium ml-1 inline hover:text-zinc-400"
                  >
                    ... more
                  </button>
                )}
              </div>
            </div>
            <p className="text-[12px] text-muted-foreground cursor-pointer pt-0.5">
              View all 12 comments
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
