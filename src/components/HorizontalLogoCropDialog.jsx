// src/components/HorizontalLogoCropDialog.jsx
import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { getCroppedImg } from '@/lib/cropImage'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { AspectRatio } from '@/components/ui/aspect-ratio'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const ASPECT = 3 / 1

/**
 * @param {{
 *   open: boolean,
 *   onOpenChange: (open: boolean) => void,
 *   imageSrc: string,
 *   onCropComplete: (blob: Blob) => void,
 * }} props
 */
export default function HorizontalLogoCropDialog({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [isApplying, setIsApplying] = useState(false)

  const handleCropComplete = useCallback((_croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleApply = async () => {
    if (!croppedAreaPixels) return
    setIsApplying(true)
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels)
      onCropComplete(blob)
      onOpenChange(false)
    } catch (err) {
      console.error('Crop failed:', err)
      toast.error('Failed to crop image')
    } finally {
      setIsApplying(false)
    }
  }

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) {
      // Reset state when closing
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPixels(null)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl gap-6">
        <DialogHeader>
          <DialogTitle>Adjust Horizontal Logo</DialogTitle>
          <DialogDescription>
            Drag to reposition · Scroll to zoom
          </DialogDescription>
        </DialogHeader>

        {/* Crop area — AspectRatio sets the 3:1 bounding box */}
        <div className="w-full overflow-hidden rounded-lg border border-border">
          <AspectRatio ratio={ASPECT} className="relative bg-muted/30">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={ASPECT}
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
                style={{
                  containerStyle: {
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '0.5rem',
                  },
                }}
              />
            )}
          </AspectRatio>
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-4 px-1">
          <span className="text-xs text-muted-foreground w-8 shrink-0">Zoom</span>
          <Slider
            min={1}
            max={3}
            step={0.05}
            value={[zoom]}
            onValueChange={([val]) => setZoom(val)}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
            {zoom.toFixed(1)}x
          </span>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isApplying}
          >
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={isApplying || !croppedAreaPixels}>
            {isApplying ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Applying…
              </>
            ) : (
              'Apply Crop'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
