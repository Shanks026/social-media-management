import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { Eye } from 'lucide-react'

export function MediaPreview({ urls, isOpen, onOpenChange, initialIndex = 0 }) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-black/90 border-none p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Media Preview</DialogTitle>
        </DialogHeader>

        <div className="relative w-full h-[80vh] flex items-center justify-center p-4">
          <Carousel
            opts={{ startIndex: initialIndex }}
            className="w-full h-full flex items-center"
          >
            <CarouselContent>
              {urls.map((url, index) => (
                <CarouselItem
                  key={index}
                  className="flex items-center justify-center"
                >
                  <img
                    src={url}
                    alt={`Preview ${index}`}
                    className="max-h-[75vh] w-auto object-contain rounded-lg shadow-2xl"
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-4 bg-white/10 hover:bg-white/20 border-none text-white" />
            <CarouselNext className="right-4 bg-white/10 hover:bg-white/20 border-none text-white" />
          </Carousel>
        </div>
      </DialogContent>
    </Dialog>
  )
}
