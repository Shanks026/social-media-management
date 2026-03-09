# Horizontal Logo Crop Modal — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Intercept the horizontal logo file selection in AgencySettings with a drag-to-reposition + zoom crop modal before uploading to Supabase, outputting a fixed 3:1 aspect ratio cropped blob.

**Architecture:** File pick triggers a local `objectURL` → shadcn Dialog opens with `react-easy-crop` in a 3:1 `AspectRatio` container → user drags/zooms → "Apply Crop" runs a canvas utility to produce a Blob → that Blob is uploaded to Supabase → existing Save flow is unchanged.

**Tech Stack:** react-easy-crop, HTML5 Canvas API, shadcn Dialog + AspectRatio + Slider, Supabase storage, React 19

---

### Task 1: Install dependencies

**Files:**
- No file changes — just installs

**Step 1: Install react-easy-crop**

```bash
npm install react-easy-crop
```

Expected: package added to `node_modules` and `package.json` dependencies.

**Step 2: Install shadcn Slider**

`AspectRatio` is already present at `src/components/ui/aspect-ratio.jsx`. Slider is missing — add it:

```bash
npx shadcn@latest add @shadcn/slider
```

Expected: `src/components/ui/slider.jsx` created.

**Step 3: Commit**

```bash
git add package.json package-lock.json src/components/ui/slider.jsx
git commit -m "chore: add react-easy-crop and shadcn slider"
```

---

### Task 2: Create canvas crop utility

**Files:**
- Create: `src/lib/cropImage.js`

**Step 1: Create the file**

```js
// src/lib/cropImage.js

/**
 * Draws the cropped region of an image onto an off-screen canvas
 * and returns the result as a Blob.
 *
 * @param {string} imageSrc  - objectURL or remote URL of the source image
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop
 * @returns {Promise<Blob>}
 */
export function getCroppedImg(imageSrc, pixelCrop) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => {
      const canvas = document.createElement('canvas')
      canvas.width = pixelCrop.width
      canvas.height = pixelCrop.height

      const ctx = canvas.getContext('2d')
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height,
      )

      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Canvas toBlob failed'))
        resolve(blob)
      }, 'image/png')
    })
    image.addEventListener('error', reject)
    image.src = imageSrc
  })
}
```

**Step 2: Commit**

```bash
git add src/lib/cropImage.js
git commit -m "feat: add getCroppedImg canvas utility"
```

---

### Task 3: Create HorizontalLogoCropDialog component

**Files:**
- Create: `src/components/HorizontalLogoCropDialog.jsx`

**Step 1: Create the component**

```jsx
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
```

**Step 2: Verify react-easy-crop renders correctly**

Start dev server (`npm run dev`) and visually check the component in isolation if possible, or proceed to Task 4 and test end-to-end.

**Step 3: Commit**

```bash
git add src/components/HorizontalLogoCropDialog.jsx
git commit -m "feat: add HorizontalLogoCropDialog with react-easy-crop"
```

---

### Task 4: Wire crop dialog into AgencySettings

**Files:**
- Modify: `src/pages/settings/AgencySettings.jsx`

**Step 1: Add new imports at the top of AgencySettings.jsx**

After the existing imports block, add:

```jsx
import HorizontalLogoCropDialog from '@/components/HorizontalLogoCropDialog'
```

**Step 2: Add two new state variables** inside `AgencySettings()`, after the existing horizontal logo state (around line 81):

```jsx
const [cropSrc, setCropSrc] = useState(null)       // local objectURL for the crop modal
const [isCropOpen, setIsCropOpen] = useState(false) // controls crop dialog visibility
```

**Step 3: Replace `handleHorizontalLogoUpload`**

Remove the current function (lines 176–196) and replace with:

```jsx
const handleHorizontalLogoUpload = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  // Revoke any previous objectURL to avoid memory leaks
  if (cropSrc) URL.revokeObjectURL(cropSrc)
  const objectUrl = URL.createObjectURL(file)
  setCropSrc(objectUrl)
  setIsCropOpen(true)
  // Reset the input so the same file can be re-selected
  e.target.value = ''
}
```

**Step 4: Add `handleCropApplied` handler** after `handleHorizontalLogoUpload`:

```jsx
const handleCropApplied = async (blob) => {
  try {
    setIsUploadingHorizontalLogo(true)
    const filePath = `branding/${Date.now()}.png`
    const { error: uploadError } = await supabase.storage
      .from('post-media')
      .upload(filePath, blob, { contentType: 'image/png' })
    if (uploadError) throw uploadError
    const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(filePath)
    setHorizontalLogoUrl(publicUrl)
    toast.success('Horizontal logo cropped! Click Save to apply.')
  } catch (error) {
    console.error(error)
    toast.error('Failed to upload cropped logo')
  } finally {
    setIsUploadingHorizontalLogo(false)
    // Clean up objectURL now that upload is done
    if (cropSrc) {
      URL.revokeObjectURL(cropSrc)
      setCropSrc(null)
    }
  }
}
```

**Step 5: Mount the dialog** in the JSX return (PATH A branch).

Find the `{/* Horizontal logo upload */}` section and add the dialog just before or after the existing horizontal logo `<div>` block (before the closing `</div>` of the outer `flex` container, around line 415):

```jsx
{/* Horizontal Logo Crop Dialog */}
<HorizontalLogoCropDialog
  open={isCropOpen}
  onOpenChange={setIsCropOpen}
  imageSrc={cropSrc || ''}
  onCropComplete={handleCropApplied}
/>
```

**Step 6: Verify end-to-end in dev**

1. `npm run dev`
2. Navigate to Settings → Agency
3. Click the horizontal logo upload area
4. Select any image file
5. Confirm the crop modal opens with the image loaded
6. Drag to reposition, use the zoom slider
7. Click "Apply Crop"
8. Confirm the upload spinner shows then the preview updates in the upload area
9. Click "Save Horizontal Logo" — confirm the toast and DB update

**Step 7: Commit**

```bash
git add src/pages/settings/AgencySettings.jsx
git commit -m "feat: wire horizontal logo crop dialog into AgencySettings"
```

---

## Notes

- `react-easy-crop` requires its container to have `position: relative` and explicit dimensions — the `AspectRatio` wrapper provides both via the absolute positioning it generates.
- The `e.target.value = ''` reset in `handleHorizontalLogoUpload` ensures re-selecting the same file fires the `onChange` event again.
- `URL.revokeObjectURL` is called after upload completes to free memory. It is also called on re-pick to avoid leaking previous objectURLs.
- Output format is always `image/png` for lossless quality; if file size becomes a concern this can be changed to `image/jpeg` with quality `0.92`.
- Only the horizontal logo upload is affected. The square agency logo upload is untouched.
