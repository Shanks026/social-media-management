import { useState } from 'react'
import {
  ThumbsUp,
  MessageSquare,
  Repeat,
  Send,
  MoreHorizontal,
  Globe,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Text parser to highlight hashtags
 */
const renderContentWithHashtags = (text) => {
  if (!text) return 'No content provided.'
  return text.split(/(\s+)/).map((word, index) => {
    if (word.startsWith('#')) {
      return (
        <span
          key={index}
          className="text-[#0a66c2] font-semibold hover:underline cursor-pointer"
        >
          {word}
        </span>
      )
    }
    return <span key={index}>{word}</span>
  })
}

export default function LinkedInPreview({ post, client }) {
  const mediaUrls = post?.media_urls || []
  const content = post?.content || ''

  // Branding Data
  const displayName = client?.name || 'Company Name'
  const logo = client?.logo_url
  const followers = '12,345 followers'
  const handle = client?.social_links?.linkedin?.handle || displayName

  /**
   * Helper to render the LinkedIn Grid Layout
   */
  const renderMediaGrid = () => {
    const count = mediaUrls.length
    if (count === 0) return null

    // 1. Single Image/Video
    if (count === 1) {
      return (
        <div className="w-full h-full">
          {mediaUrls[0].includes('video') ? (
            <video
              src={mediaUrls[0]}
              controls
              className="w-full h-auto max-h-[500px] object-cover"
            />
          ) : (
            <img
              src={mediaUrls[0]}
              alt="Post media"
              className="w-full h-auto object-cover"
            />
          )}
        </div>
      )
    }

    // 2. Two Images (50/50 Split)
    if (count === 2) {
      return (
        <div className="flex h-[300px] w-full gap-[2px]">
          {mediaUrls.map((url, i) => (
            <div key={i} className="relative w-1/2 h-full">
              <img src={url} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )
    }

    // 3. Three Images (1 Left, 2 Stacked Right)
    if (count === 3) {
      return (
        <div className="flex h-[300px] w-full gap-[2px]">
          <div className="w-[60%] h-full">
            <img
              src={mediaUrls[0]}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col w-[40%] h-full gap-[2px]">
            <div className="h-1/2 w-full">
              <img
                src={mediaUrls[1]}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <div className="h-1/2 w-full">
              <img
                src={mediaUrls[2]}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      )
    }

    // 4. Four+ Images (1 Top, 3 Bottom)
    // or (1 Left, 2 Right with overlay) - Let's do the "Left + Stack" with overlay
    return (
      <div className="flex h-[300px] w-full gap-[2px]">
        <div className="w-[60%] h-full">
          <img
            src={mediaUrls[0]}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex flex-col w-[40%] h-full gap-[2px]">
          <div className="h-1/2 w-full relative">
            <img
              src={mediaUrls[1]}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="h-1/2 w-full relative group cursor-pointer">
            <img
              src={mediaUrls[2]}
              alt=""
              className="w-full h-full object-cover"
            />
            {/* Overlay for remaining images */}
            {count > 3 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-medium text-xl">
                +{count - 3}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[500px] overflow-hidden rounded-lg border border-[#e0dfdc] bg-white shadow-sm dark:bg-[#1b1f23] dark:border-[#373b3e] transition-colors">
      {/* 1. Header */}
      <div className="flex items-start justify-between p-3 pb-2">
        <div className="flex gap-3">
          {/* Logo */}
          <div className="size-12 shrink-0">
            {logo ? (
              <img
                src={logo}
                alt={displayName}
                className="size-full object-contain"
              />
            ) : (
              <div className="size-full flex items-center justify-center bg-[#f3f2ef] text-[#0a66c2] font-bold text-xl uppercase">
                {displayName.slice(0, 1)}
              </div>
            )}
          </div>

          {/* Meta Info */}
          <div className="flex flex-col">
            <span className="text-[14px] font-semibold text-black dark:text-white leading-tight hover:underline cursor-pointer decoration-[#0a66c2]">
              {displayName}
            </span>
            <span className="text-[12px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
              {followers}
            </span>
            <div className="flex items-center gap-1 text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
              <span>2d</span>
              <span>•</span>
              <Globe size={12} className="opacity-70" />
            </div>
          </div>
        </div>

        <MoreHorizontal
          size={20}
          className="text-gray-600 dark:text-gray-300 cursor-pointer"
        />
      </div>

      {/* 2. Content */}
      <div className="px-3 pb-2 text-[14px] text-black dark:text-white whitespace-pre-wrap leading-relaxed">
        {renderContentWithHashtags(content)}
      </div>

      {/* 3. Media Grid */}
      <div className="w-full bg-[#f3f2ef] dark:bg-black overflow-hidden">
        {renderMediaGrid()}
      </div>

      {/* 4. Social Counts */}
      <div className="mx-3 py-2 border-b border-[#e0dfdc] dark:border-[#373b3e] flex items-center justify-between text-[12px] text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1 hover:text-[#0a66c2] hover:underline cursor-pointer">
          {/* Mock Reaction Pile */}
          <div className="flex -space-x-1">
            <div className="bg-[#1485bd] rounded-full p-[2px]">
              <ThumbsUp size={8} className="text-white fill-white" />
            </div>
            <div className="bg-[#df704d] rounded-full p-[2px]">
              <div className="text-[6px] text-white">❤️</div>
            </div>
            <div className="bg-[#56a32d] rounded-full p-[2px]">
              <div className="text-[6px] text-white">👏</div>
            </div>
          </div>
          <span className="ml-1">325</span>
        </div>
        <div className="flex gap-2 hover:text-[#0a66c2] cursor-pointer">
          <span className="hover:underline">103 comments</span>
          <span>•</span>
          <span className="hover:underline">34 reposts</span>
        </div>
      </div>

      {/* 5. Action Bar */}
      <div className="flex items-center justify-between px-2 py-1">
        <ActionButton icon={ThumbsUp} label="Like" />
        <ActionButton icon={MessageSquare} label="Comment" />
        <ActionButton icon={Repeat} label="Repost" />
        <ActionButton icon={Send} label="Send" />
      </div>
    </div>
  )
}

const ActionButton = ({ icon: Icon, label }) => (
  <button className="flex items-center gap-1.5 px-3 py-3 rounded hover:bg-[#00000014] dark:hover:bg-[#ffffff14] transition-colors text-gray-600 dark:text-gray-300 font-semibold group">
    <Icon size={20} className="group-hover:stroke-2 transition-all" />
    <span className="text-[14px] text-gray-600 dark:text-gray-300 group-hover:text-black dark:group-hover:text-white">
      {label}
    </span>
  </button>
)
