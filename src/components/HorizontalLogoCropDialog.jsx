import { useState, useRef } from 'react'
import ReactCrop from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

function makeInitialCrop() {
  return { unit: '%', x: 5, y: 5, width: 90, height: 90 }
}

export default function HorizontalLogoCropDialog({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
}) {
  const [crop, setCrop] = useState(undefined)
  const [completedCrop, setCompletedCrop] = useState(null)
  const [isApplying, setIsApplying] = useState(false)
  const imgRef = useRef(null)

  function onImageLoad(e) {
    const { width, height } = e.currentTarget
    const pct = makeInitialCrop()
    setCrop(pct)
    // Pre-populate completedCrop in display pixels so Apply is enabled immediately
    setCompletedCrop({
      unit: 'px',
      x: (pct.x * width) / 100,
      y: (pct.y * height) / 100,
      width: (pct.width * width) / 100,
      height: (pct.height * height) / 100,
    })
  }

  const handleApply = async () => {
    if (!completedCrop || !imgRef.current) return
    setIsApplying(true)
    try {
      const image = imgRef.current
      const scaleX = image.naturalWidth / image.width
      const scaleY = image.naturalHeight / image.height
      const cropW = Math.round(completedCrop.width * scaleX)
      const cropH = Math.round(completedCrop.height * scaleY)

      // Draw directly from the already-loaded img element — no re-fetch of the objectURL
      const canvas = document.createElement('canvas')
      canvas.width = cropW
      canvas.height = cropH
      const ctx = canvas.getContext('2d')
      ctx.drawImage(
        image,
        Math.round(completedCrop.x * scaleX),
        Math.round(completedCrop.y * scaleY),
        cropW,
        cropH,
        0,
        0,
        cropW,
        cropH,
      )

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/png')
      })

      await onCropComplete(blob)
      onOpenChange(false)
    } catch (err) {
      console.error('Crop/upload failed:', err)
      toast.error('Failed to upload logo')
    } finally {
      setIsApplying(false)
    }
  }

  const handleOpenChange = (nextOpen) => {
    if (isApplying) return
    if (!nextOpen) {
      setCrop(undefined)
      setCompletedCrop(null)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl gap-6">
        <DialogHeader>
          <DialogTitle>Adjust Horizontal Logo</DialogTitle>
          <DialogDescription>
            Drag the selection to reposition · Drag handles to resize
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center bg-muted/30 rounded-lg border border-border p-3">
          {imageSrc && (
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              minWidth={20}
              minHeight={20}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop preview"
                onLoad={onImageLoad}
                style={{ maxHeight: '320px', maxWidth: '100%', display: 'block' }}
              />
            </ReactCrop>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isApplying}
          >
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={isApplying || !completedCrop}>
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
