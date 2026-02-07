import { Sheet, SheetContent } from '@/components/ui/sheet'
import { X } from 'lucide-react'
import InstagramPreview from './InstagramPreview'

export default function SocialMediaPreview({ isOpen, onOpenChange, post }) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      {/* Remove standard p-0 and use flex-col for a structured layout.
           The h-full ensures the container fills the entire sheet.
        */}
      <SheetContent className="w-full sm:max-w-md md:max-w-xl border-l shadow-2xl p-0 flex flex-col h-full overflow-hidden">
        {/* 🛠️ Manual Header: Sticky, non-blocking, and clean */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
          <div className="space-y-0.5">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Social media preview
            </h2>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Mobile Mockup
            </p>
          </div>

          {/* Note: SheetContent usually includes a default close button, 
               but we are manually spacing this header to feel like a dashboard.
            */}
        </div>

        {/* 🚀 Scrollable Content Area: 
             Using flex-1 ensures it takes up the remaining space.
             bg-muted/10 gives a nice depth contrast behind the mobile mockup.
          */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-muted/10">
          <div className="flex items-center justify-center p-8 md:p-12 min-h-full">
            <InstagramPreview post={post} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
