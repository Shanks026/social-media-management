import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, User, Layers } from 'lucide-react'
import { format } from 'date-fns'

export function PostDetailDialog({ post, open, onOpenChange }) {
  if (!post) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0 gap-0 border-none shadow-2xl">
        {/* Visual Header / Media Preview Area */}
        <div className="aspect-video bg-muted relative overflow-hidden group">
          {/* Fallback for media since it's not in your sample yet */}
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/20 italic font-black text-4xl uppercase tracking-tighter">
            Media Preview
          </div>
          {/* If you have media: <img src={post.media_url} className="w-full h-full object-cover" /> */}

          <Badge className="absolute top-4 left-4 bg-background/80 backdrop-blur text-foreground border-none font-black uppercase text-[10px]">
            {post.status.replace('_', ' ')}
          </Badge>
        </div>

        <div className="p-6 space-y-6">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <img
                src={post.client_logo}
                alt={post.client_name}
                className="size-6 rounded-full ring-2 ring-muted shadow-sm"
              />
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                {post.client_name}
              </span>
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight">
              {post.title}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4 border-y border-muted/50">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-black text-muted-foreground">
                  Target Date
                </span>
                <span className="text-sm font-bold">
                  {format(new Date(post.target_date), 'PPP')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-black text-muted-foreground">
                  Posting Time
                </span>
                <span className="text-sm font-bold">
                  {format(new Date(post.target_date), 'p')}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] uppercase font-black text-muted-foreground">
              Caption / Content
            </span>
            <div className="p-4 rounded-xl bg-muted/30 border border-muted/20 text-sm leading-relaxed font-medium">
              {post.content}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            <div className="flex gap-2">
              {post.platforms.map((platform) => (
                <Badge
                  key={platform}
                  variant="outline"
                  className="capitalize font-bold border-muted-foreground/20 px-3 py-1 text-[10px]"
                >
                  {platform}
                </Badge>
              ))}
            </div>
            <span className="text-[9px] font-black uppercase opacity-30 flex items-center gap-1">
              <Layers size={10} /> v.{post.version_id.split('-')[0]}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
