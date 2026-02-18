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
import LinkedInPreview from './LinkedInPreview' // <--- IMPORT
import { Label } from '@/components/ui/label'
import YouTubePreview from './YouTubePreview'

export default function SocialMediaPreview({
  isOpen,
  onOpenChange,
  post,
  client,
}) {
  const availablePlatforms = [].concat(post?.platform || [])
  const [activePlatform, setActivePlatform] = useState(
    availablePlatforms[0] || 'instagram',
  )

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
        {/* Header */}
        <div className="px-6 py-4 border-b bg-background shrink-0 space-y-3">
          <div className="space-y-0.5">
            <h2 className="text-lg font-medium tracking-tight text-foreground">
              Social Media Preview
            </h2>
            <p className="text-xs font-medium text-muted-foreground tracking-wider">
              Mobile Mockup
            </p>
          </div>
        </div>

        {/* Platform Selector */}
        <div className="px-6 py-3 bg-background shrink-0 flex justify-between items-center">
          <Label>Select Platform</Label>
          {availablePlatforms.length > 1 ? (
            <Select value={activePlatform} onValueChange={setActivePlatform}>
              <SelectTrigger className="w-[180px] h-9 text-sm font-medium shadow-none">
                <SelectValue className="capitalize" placeholder="Platform" />
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
            <div className="px-3 py-1.5 rounded-md bg-muted text-sm font-medium text-muted-foreground capitalize w-fit">
              {activePlatform === 'twitter' ? 'X / Twitter' : activePlatform}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-muted/10">
          <div className="flex items-start justify-center p-4 min-h-full">
            {/* 🛠️ RENDER LOGIC */}
            {activePlatform === 'twitter' && (
              <TwitterPreview post={post} client={client} />
            )}
            {activePlatform === 'linkedin' && (
              <LinkedInPreview post={post} client={client} />
            )}
            {activePlatform === 'instagram' && (
              <InstagramPreview post={post} client={client} />
            )}
            {activePlatform === 'youtube' && (
              <YouTubePreview post={post} client={client} />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
