import { useState, useEffect } from 'react'
import {
  MoreVertical,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Share2,
  Music2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

export default function YouTubePreview({ post, client }) {
  const mediaUrl = post?.media_urls?.[0]
  const title =
    post?.title || post?.content?.split('\n')[0] || 'Video Title Goes Here'

  // Branding
  const channelName = client?.name || 'Channel Name'
  const logo = client?.logo_url

  // Aspect Ratio Logic
  const [isShorts, setIsShorts] = useState(false)

  useEffect(() => {
    if (!mediaUrl) return
    const video = document.createElement('video')
    video.src = mediaUrl
    video.onloadedmetadata = () => {
      // If height > width, treat as Shorts
      if (video.videoHeight > video.videoWidth) {
        setIsShorts(true)
      } else {
        setIsShorts(false)
      }
    }
  }, [mediaUrl])

  // --- RENDER: YOUTUBE SHORTS MODE ---
  if (isShorts) {
    return (
      <div className="flex flex-col gap-2 mx-auto w-full max-w-[350px]">
        {/* Toggle */}
        <div className="flex items-center justify-end space-x-2 mb-2">
          <Label
            htmlFor="shorts-mode"
            className="text-xs font-medium text-zinc-500"
          >
            Video
          </Label>
          <Switch
            id="shorts-mode"
            checked={isShorts}
            onCheckedChange={setIsShorts}
          />
          <Label
            htmlFor="shorts-mode"
            className="text-xs font-medium text-zinc-900 dark:text-zinc-100"
          >
            Shorts
          </Label>
        </div>

        <div className="relative w-full aspect-[9/16] bg-black rounded-[2rem] overflow-hidden border-[6px] border-black shadow-2xl">
          {/* Video */}
          {mediaUrl ? (
            <video
              src={mediaUrl}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <div className="absolute inset-0 bg-zinc-800 flex items-center justify-center text-zinc-500">
              No Video
            </div>
          )}

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none" />

          {/* Right Action Bar (Updated Size) */}
          <div className="absolute right-2 bottom-12 flex flex-col items-center gap-5 text-white z-20">
            <ActionItem icon={ThumbsUp} label="1.2K" filled />
            <ActionItem icon={ThumbsDown} label="Dislike" />
            <ActionItem icon={MessageSquare} label="405" filled />
            <ActionItem icon={Share2} label="Share" />

            {/* Spinning Album Art */}
            <div className="size-9 bg-zinc-800 rounded-lg overflow-hidden border-2 border-white/20 mt-1 relative">
              {logo ? (
                <img
                  src={logo}
                  className="w-full h-full object-cover animate-[spin_4s_linear_infinite]"
                />
              ) : (
                <div className="w-full h-full bg-zinc-700 animate-[spin_4s_linear_infinite]" />
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="size-2.5 bg-black rounded-full" />
              </div>
            </div>
          </div>

          {/* Bottom Info */}
          <div className="absolute left-4 bottom-6 right-14 text-white text-left z-20">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-7 rounded-full bg-zinc-700 overflow-hidden border border-white/20 shrink-0">
                {logo ? (
                  <img src={logo} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-[9px] font-bold p-2 text-center flex items-center justify-center w-full h-full">
                    {channelName.slice(0, 1)}
                  </div>
                )}
              </div>
              <span className="font-semibold text-[12px] drop-shadow-md truncate max-w-[100px]">
                @{channelName.replace(/\s/g, '')}
              </span>
              <button className="bg-white text-black text-[9px] font-bold px-2.5 py-1 rounded-full hover:bg-zinc-200 transition-colors">
                Subscribe
              </button>
            </div>

            <p className="text-[13px] leading-snug line-clamp-2 drop-shadow-md mb-3 font-normal">
              {title} <span className="font-bold cursor-pointer">#shorts</span>
            </p>

            <div className="flex items-center gap-2 opacity-90 overflow-hidden">
              <Music2 size={12} />
              <div className="text-[12px] whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                Original sound - {channelName}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- RENDER: STANDARD VIDEO MODE ---
  return (
    <div className="flex flex-col w-full max-w-[400px] mx-auto gap-2">
      {/* Toggle */}
      {mediaUrl && (
        <div className="flex items-center justify-end space-x-2 px-2">
          <Label
            htmlFor="video-mode"
            className="text-xs font-medium text-zinc-900 dark:text-zinc-100"
          >
            Video
          </Label>
          <Switch
            id="video-mode"
            checked={isShorts}
            onCheckedChange={setIsShorts}
          />
          <Label
            htmlFor="video-mode"
            className="text-xs font-medium text-zinc-500"
          >
            Shorts
          </Label>
        </div>
      )}

      <div className="w-full bg-white dark:bg-[#0f0f0f] rounded-none sm:rounded-xl overflow-hidden shadow-sm border border-transparent sm:border-zinc-200 sm:dark:border-zinc-800">
        <div className="relative aspect-video bg-black group">
          {mediaUrl ? (
            <video
              src={mediaUrl}
              className="w-full h-full object-cover"
              muted
              playsInline
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-500">
              No Video Source
            </div>
          )}
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            10:24
          </div>
        </div>

        <div className="flex gap-3 p-3 text-left">
          <div className="size-9 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0 overflow-hidden">
            {logo ? (
              <img src={logo} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-zinc-500">
                {channelName.slice(0, 1)}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1 w-full">
            <h3 className="text-[14px] font-semibold text-black dark:text-white leading-tight line-clamp-2">
              {title}
            </h3>
            <div className="text-[12px] text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
              <span>{channelName}</span>
              <span>•</span>
              <span>12K views</span>
              <span>•</span>
              <span>2 hours ago</span>
            </div>
          </div>
          <MoreVertical
            size={20}
            className="text-zinc-800 dark:text-white shrink-0"
          />
        </div>
      </div>
    </div>
  )
}

// Helper for Shorts Action Bar Icons
// Reduced padding to p-2, icon size to 20, and text to 10px
// eslint-disable-next-line no-unused-vars
function ActionItem({ icon: Icon, label, filled }) {
  return (
    <div className="flex flex-col items-center gap-0.5 drop-shadow-md">
      <div className="p-2 bg-black/40 backdrop-blur-[2px] rounded-full hover:bg-black/60 transition-colors cursor-pointer flex items-center justify-center">
        <Icon size={20} className={cn('text-white', filled && 'fill-white')} />
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </div>
  )
}
