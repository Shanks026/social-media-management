import {
  MessageCircle,
  Repeat2,
  Heart,
  Share,
  MoreHorizontal,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Play,
} from 'lucide-react'
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

export default function TwitterPreview({ post, client }) {

  const mediaUrls = post?.media_urls || []
  const content = post?.content || ''
  const handle = client?.social_links?.twitter?.handle || 'username'
  const displayName = client?.name || 'Display Name'
  const logo = client?.logo_url

  return (
    <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-black transition-colors duration-200">
      {/* 1. Header */}
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
          <div className="size-10 shrink-0 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
            {logo ? (
              <img src={logo} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs font-bold text-zinc-400">
                {client?.name?.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1 truncate">
              <span className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
                {displayName}
              </span>
              <BadgeCheck
                size={16}
                className="fill-[#1d9bf0] text-white dark:text-black shrink-0"
              />
            </div>
            <span className="text-[14px] text-zinc-500 dark:text-zinc-500 truncate">
              @{handle.replace('@', '')}
            </span>
          </div>
        </div>
        <MoreHorizontal size={18} className="text-zinc-500" />
      </div>

      {/* 2. Content */}
      <div className="mt-3">
        <p className="text-[15px] leading-normal text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">
          {content || 'This is a preview of your post content on X.'}
        </p>
      </div>

      {/* 3. Media Grid / Carousel */}
      {mediaUrls.length > 0 && (
        <div className="mt-3 relative group">
          <div
            className={cn(
              'grid gap-[2px] overflow-hidden border border-zinc-200 dark:border-zinc-800 rounded-2xl',
              mediaUrls.length === 1
                ? 'grid-cols-1'
                : 'grid-cols-2 aspect-[16/9]',
            )}
          >
            {/* Logic for the 4-image grid style like your reference */}
            {mediaUrls.slice(0, 4).map((url, idx) => (
              <div
                key={url}
                className={cn(
                  'relative bg-zinc-100 dark:bg-zinc-900 overflow-hidden',
                  mediaUrls.length === 3 && idx === 0 ? 'row-span-2' : '',
                )}
              >
                {isVideoSource(url) ? (
                  <div className="h-full w-full flex items-center justify-center bg-black">
                    <Play
                      size={32}
                      className="text-white fill-white opacity-80"
                    />
                  </div>
                ) : (
                  <img
                    src={url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            ))}
          </div>

          {mediaUrls.length > 4 && (
            <div className="absolute inset-0 flex items-center justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                className="bg-black/50 text-white rounded-full p-1"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className="bg-black/50 text-white rounded-full p-1"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. Timestamp & Meta */}
      <div className="mt-3 flex items-center gap-1 text-[14px] text-zinc-500 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-900 pb-3">
        <span>{format(new Date(), 'h:mm a')}</span>
        <span>·</span>
        <span>{format(new Date(), 'MMM d, yyyy')}</span>
        <span>·</span>
        <span className="font-bold text-zinc-900 dark:text-zinc-100">
          Twitter for Phone
        </span>
      </div>

      {/* 5. Stats Section */}
      <div className="flex items-center gap-4 py-3 border-b border-zinc-100 dark:border-zinc-900">
        <div className="flex gap-1 text-[14px]">
          <span className="font-bold text-zinc-900 dark:text-zinc-100">
            7,854
          </span>
          <span className="text-zinc-500">Retweets</span>
        </div>
        <div className="flex gap-1 text-[14px]">
          <span className="font-bold text-zinc-900 dark:text-zinc-100">
            34.1k
          </span>
          <span className="text-zinc-500">Likes</span>
        </div>
      </div>

      {/* 6. Action Bar */}
      <div className="flex items-center justify-between px-4 py-2 mt-1">
        <MessageCircle
          size={18}
          className="text-zinc-500 hover:text-[#1d9bf0] cursor-pointer transition-colors"
        />
        <Repeat2
          size={18}
          className="text-zinc-500 hover:text-[#00ba7c] cursor-pointer transition-colors"
        />
        <Heart
          size={18}
          className="text-zinc-500 hover:text-[#f91880] cursor-pointer transition-colors"
        />
        <Share
          size={18}
          className="text-zinc-500 hover:text-[#1d9bf0] cursor-pointer transition-colors"
        />
      </div>
    </div>
  )
}
