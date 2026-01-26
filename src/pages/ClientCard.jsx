import { useState } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  MoreVertical,
  Pencil,
  Trash2,
  Instagram,
  Linkedin,
  Twitter,
  Crown,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const PlatformIcon = ({ name }) => {
  const icons = {
    instagram: {
      icon: <Instagram className="size-3.5 text-white" />,
      bg: 'bg-[#E4405F]',
    },
    linkedin: {
      icon: <Linkedin className="size-3.5 text-white" />,
      bg: 'bg-[#0077B5]',
    },
    twitter: {
      icon: <Twitter className="size-3.5 text-white" />,
      bg: 'bg-black',
    },
  }

  const platform = icons[name.toLowerCase()]
  if (!platform) return null

  return (
    <div
      className={`size-8 rounded-full border-2 border-white dark:border-[#18181b] flex items-center justify-center ${platform.bg}`}
    >
      {platform.icon}
    </div>
  )
}

function ClientCard({ client, onOpen, onEdit, onDelete }) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  const tier = client.tier?.toUpperCase() || 'VIP'
  const industry = client.industry || 'Food and Eatables'
  const pipeline = client.pipeline || { drafts: 12, pending: 3, scheduled: 7 }
  const platforms = client.platforms || ['instagram', 'linkedin', 'twitter']
  const nextPost = '20 Jan 2026'

  const initials = client.name
    ? client.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'CL'

  const renderTierBadge = () => {
    if (tier === 'VIP') {
      return (
        <Badge className="bg-purple-600 hover:bg-purple-600 text-white border-none text-[10px] h-5 px-2 gap-1 rounded-md shadow-sm">
          <Crown className="size-3 fill-current" /> VIP
        </Badge>
      )
    }
    if (tier === 'PRO') {
      return (
        <Badge className="bg-amber-400 hover:bg-amber-400 text-amber-900 border-none text-[10px] h-5 px-2 gap-1 rounded-md shadow-sm">
          <Zap className="size-3 fill-current" /> PRO
        </Badge>
      )
    }
    return null
  }

  return (
    <>
      <Card
        onClick={() => onOpen(client)}
        // Added transition-colors and duration-300 to fix the background swap delay
        className="group cursor-pointer shadow-none border-none transition-colors duration-300 bg-[#FCFCFC] dark:bg-card/40 hover:bg-gray-50 dark:hover:bg-[#242427]"
      >
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div className="flex gap-4 items-center">
              <div className="h-16 w-16 shrink-0 rounded-xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 flex items-center justify-center overflow-hidden">
                {client.logo_url ? (
                  <img
                    src={client.logo_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-gray-100 dark:bg-zinc-800 text-gray-400 font-bold text-xl">
                    {initials}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                    {client.name}
                  </h3>
                  {renderTierBadge()}
                </div>
                <p className="text-sm text-muted-foreground">{industry}</p>
              </div>
            </div>

            <Popover>
              <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  <MoreVertical className="size-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-32 p-1">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-xs h-9"
                  onClick={() => onEdit(client)}
                >
                  <Pencil className="mr-2 size-4" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-xs h-9 text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 size-4" /> Delete
                </Button>
              </PopoverContent>
            </Popover>
          </div>

          {/* Pipeline */}
          <div className="flex items-center gap-6 mb-8">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-blue-500" />
              <span className="text-sm font-semibold dark:text-white">
                {pipeline.drafts}
              </span>
              <span className="text-sm text-muted-foreground">Drafts</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-amber-500" />
              <span className="text-sm font-semibold dark:text-white">
                {pipeline.pending}
              </span>
              <span className="text-sm text-muted-foreground">
                Pending App.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-purple-500" />
              <span className="text-sm font-semibold dark:text-white">
                {pipeline.scheduled}
              </span>
              <span className="text-sm text-muted-foreground">Scheduled</span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-5 border-t border-gray-100 dark:border-white/5">
            <div className="flex -space-x-2">
              {platforms.map((p, i) => (
                <div key={p} style={{ zIndex: 10 - i }}>
                  <PlatformIcon name={p} />
                </div>
              ))}
              <div className="size-8 rounded-full border-2 border-white dark:border-[#18181b] bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-500 dark:text-gray-400 text-[10px] font-bold z-0">
                +2
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-green-500" />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Next Post: {nextPost}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Remove <span className="font-bold">{client.name}</span> from the
              workspace?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => onDelete(client)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default ClientCard
