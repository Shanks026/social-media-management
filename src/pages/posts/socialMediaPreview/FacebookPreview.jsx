import { useState } from 'react'
import { MoreHorizontal, ThumbsUp, MessageSquare, Share2, Globe, Play, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const isVideoSource = (url) => {
  if (!url) return false
  const videoExtensions = ['.mp4', '.mov', '.webm', '.ogg', '.m4v']
  return (
    videoExtensions.some((ext) => url.toLowerCase().includes(ext)) ||
    url.includes('video')
  )
}

const renderParsedContent = (text) => {
  if (!text) return null
  return text.split(/(\s+)/).map((part, i) => {
    if (part.startsWith('#') || part.startsWith('@')) {
      return (
        <span key={i} className="text-[#1877F2] cursor-pointer hover:underline">
          {part}
        </span>
      )
    }
    return part
  })
}

function MediaTile({ url, className }) {
  return (
    <div className={cn('relative overflow-hidden bg-zinc-100 dark:bg-zinc-900', className)}>
      {isVideoSource(url) ? (
        <>
          <video
            src={url}
            className="w-full h-full object-cover"
            muted
            playsInline
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="size-10 rounded-full bg-black/50 flex items-center justify-center">
              <Play size={18} className="text-white fill-white ml-0.5" />
            </div>
          </div>
        </>
      ) : (
        <img src={url} alt="" className="w-full h-full object-cover" />
      )}
    </div>
  )
}

function MediaGrid({ mediaUrls }) {
  const [page, setPage] = useState(0)
  const count = mediaUrls.length

  if (count === 0) return null

  // Single media — preserve aspect ratio
  if (count === 1) {
    const url = mediaUrls[0]
    return (
      <div className="w-full bg-black overflow-hidden">
        {isVideoSource(url) ? (
          <div className="relative w-full aspect-video">
            <video
              src={url}
              className="w-full h-full object-contain bg-black"
              autoPlay
              muted
              loop
              playsInline
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="size-12 rounded-full bg-black/40 flex items-center justify-center">
                <Play size={20} className="text-white fill-white ml-1" />
              </div>
            </div>
          </div>
        ) : (
          <img src={url} alt="" className="w-full max-h-[400px] object-cover" />
        )}
      </div>
    )
  }

  // 2 images: side by side equal halves
  if (count === 2) {
    return (
      <div className="grid grid-cols-2 gap-[2px] w-full aspect-[4/3]">
        <MediaTile url={mediaUrls[0]} className="w-full h-full" />
        <MediaTile url={mediaUrls[1]} className="w-full h-full" />
      </div>
    )
  }

  // 3 images: left big, right two stacked
  if (count === 3) {
    return (
      <div className="grid grid-cols-2 gap-[2px] w-full aspect-[4/3]">
        <MediaTile url={mediaUrls[0]} className="w-full h-full row-span-2" />
        <div className="grid grid-rows-2 gap-[2px]">
          <MediaTile url={mediaUrls[1]} className="w-full h-full" />
          <MediaTile url={mediaUrls[2]} className="w-full h-full" />
        </div>
      </div>
    )
  }

  // 4 images: 2x2 grid
  if (count === 4) {
    return (
      <div className="grid grid-cols-2 gap-[2px] w-full aspect-[4/3]">
        {mediaUrls.slice(0, 4).map((url, i) => (
          <MediaTile key={i} url={url} className="w-full h-full" />
        ))}
      </div>
    )
  }

  // 5+ images: 2 on top, 3 on bottom with "+X more" overlay on last
  const visible = mediaUrls.slice(page * 5, page * 5 + 5)
  const remaining = count - (page * 5 + 5)
  const totalPages = Math.ceil(count / 5)

  return (
    <div className="relative">
      <div className="grid grid-cols-3 gap-[2px] w-full">
        {/* Top row: 2 tiles */}
        <div className="col-span-3 grid grid-cols-2 gap-[2px] aspect-[2/1]">
          <MediaTile url={visible[0]} className="w-full h-full" />
          <MediaTile url={visible[1]} className="w-full h-full" />
        </div>
        {/* Bottom row: 3 tiles */}
        <div className="col-span-3 grid grid-cols-3 gap-[2px] aspect-[3/1]">
          {visible.slice(2, 5).map((url, i) => {
            const isLast = i === 2 && remaining > 0
            return (
              <div key={i} className="relative overflow-hidden">
                <MediaTile url={url} className="w-full h-full" />
                {isLast && (
                  <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                    <span className="text-white text-xl font-bold">+{remaining}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Page nav for 10+ */}
      {totalPages > 1 && (
        <div className="absolute bottom-2 right-2 flex gap-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="bg-black/50 text-white rounded-full p-1 disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="bg-black/50 text-white rounded-full p-1 disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

export default function FacebookPreview({ post, client }) {
  const [isLiked, setIsLiked] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const mediaUrls = post?.media_urls || []
  const content = post?.content || ''
  const displayName = client?.name || 'Page Name'
  const logo = client?.logo_url
  const handle = client?.social_links?.facebook?.handle

  const timestamp = `${format(new Date(), 'EEEE')} at ${format(new Date(), 'h:mm a')}`

  return (
    <div className="w-full max-w-[420px] mx-auto rounded-xl overflow-hidden bg-white dark:bg-[#242526] border border-zinc-200 dark:border-zinc-700 shadow-xl">

      {/* Header */}
      <div className="flex items-start justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          {/* Avatar */}
          <div className="size-10 rounded-full overflow-hidden shrink-0 bg-[#1877F2] flex items-center justify-center">
            {logo ? (
              <img src={logo} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-bold text-base select-none">
                {displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          {/* Name + meta */}
          <div className="flex flex-col min-w-0">
            <span className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 leading-none truncate">
              {handle ? `@${handle.replace('@', '')}` : displayName}
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[12px] text-zinc-500 dark:text-zinc-400">
                {timestamp}
              </span>
              <span className="text-zinc-400">·</span>
              <Globe size={11} className="text-zinc-400" />
            </div>
          </div>
        </div>
        <MoreHorizontal size={18} className="text-zinc-500 dark:text-zinc-400 mt-1 shrink-0" />
      </div>

      {/* Caption */}
      {content && (
        <div className="px-3 pb-2 text-[14px] leading-[1.4] text-zinc-900 dark:text-zinc-100">
          <span className={cn(!isExpanded && 'line-clamp-3')}>
            {renderParsedContent(content)}
          </span>
          {content.length > 120 && !isExpanded && (
            <button
              onClick={() => setIsExpanded(true)}
              className="text-zinc-500 dark:text-zinc-400 font-medium ml-1 hover:underline"
            >
              See more
            </button>
          )}
        </div>
      )}

      {/* Media */}
      <MediaGrid mediaUrls={mediaUrls} />

      {/* Reactions row */}
      <div className="px-3 pt-2.5 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* Reaction emoji stack */}
          <div className="flex -space-x-0.5">
            <span className="size-[18px] rounded-full bg-[#1877F2] flex items-center justify-center text-[10px] border border-white dark:border-[#242526]">👍</span>
            <span className="size-[18px] rounded-full bg-[#F33E58] flex items-center justify-center text-[10px] border border-white dark:border-[#242526]">❤️</span>
            <span className="size-[18px] rounded-full bg-[#F7B928] flex items-center justify-center text-[10px] border border-white dark:border-[#242526]">😮</span>
          </div>
          <span className="text-[13px] text-zinc-500 dark:text-zinc-400 ml-1">
            {isLiked ? '292' : '291'}
          </span>
        </div>
        <span className="text-[13px] text-zinc-500 dark:text-zinc-400 cursor-pointer hover:underline">
          55 comments
        </span>
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-zinc-200 dark:border-zinc-700" />

      {/* Action buttons */}
      <div className="flex items-center divide-x divide-zinc-200 dark:divide-zinc-700 px-2 py-1">
        <button
          onClick={() => setIsLiked((v) => !v)}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-none text-[13px] font-semibold transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700',
            isLiked ? 'text-[#1877F2]' : 'text-zinc-600 dark:text-zinc-400',
          )}
        >
          <ThumbsUp size={16} className={cn(isLiked && 'fill-[#1877F2]')} />
          Like
        </button>
        <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-none text-[13px] font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
          <MessageSquare size={16} />
          Comment
        </button>
        <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-none text-[13px] font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
          <Share2 size={16} />
          Share
        </button>
      </div>
    </div>
  )
}
