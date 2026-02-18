import { useState, useEffect } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import InstagramPreview from './InstagramPreview'
import TwitterPreview from './TwitterPreview'

export default function SocialMediaPreview({
  isOpen,
  onOpenChange,
  post,
  client,
}) {
  // Get platforms from post, ensuring it's an array
  const availablePlatforms = [].concat(post?.platform || [])

  // Default to the first platform selected in the post
  const [activePlatform, setActivePlatform] = useState(
    availablePlatforms[0] || 'instagram',
  )

  // Sync active platform if post data changes while open
  useEffect(() => {
    if (
      availablePlatforms.length > 0 &&
      !availablePlatforms.includes(activePlatform)
    ) {
      setActivePlatform(availablePlatforms[0])
    }
  }, [post?.platform])

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md md:max-w-xl border-l shadow-2xl p-0 flex flex-col h-full overflow-hidden">
        {/* 🛠️ Header with Platform Switcher */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
          <div className="space-y-0.5">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Preview
            </h2>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Mobile Mockup
            </p>
          </div>

          {/* Platform Selector */}
          {availablePlatforms.length > 1 ? (
            <Select value={activePlatform} onValueChange={setActivePlatform}>
              <SelectTrigger className="w-[140px] h-9 text-sm font-medium border-zinc-200 dark:border-zinc-800">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                {availablePlatforms.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {p === 'twitter' ? 'X / Twitter' : p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="px-3 py-1 rounded-full bg-muted text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {activePlatform === 'twitter' ? 'X / Twitter' : activePlatform}
            </div>
          )}
        </div>

        {/* 🚀 Dynamic Mockup Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-muted/10">
          <div className="flex items-center justify-center p-8 md:p-12 min-h-full">
            {activePlatform === 'twitter' ? (
              <TwitterPreview post={post} client={client} />
            ) : (
              <InstagramPreview post={post} client={client} />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
