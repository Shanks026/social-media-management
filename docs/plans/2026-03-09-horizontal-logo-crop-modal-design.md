# Horizontal Logo Crop Modal — Design Doc
Date: 2026-03-09

## Overview
Add a crop/adjust modal that intercepts file selection for the horizontal logo upload in `AgencySettings.jsx`. The user drags to reposition and scrolls to zoom within a fixed 3:1 aspect ratio viewport before the image is uploaded to Supabase.

## Context
- **Field:** `agency_subscriptions.logo_horizontal_url`
- **Used in:** Invoice PDF (`InvoicePDF.jsx` at `height: 36, maxWidth: 240`), HTML invoice preview, email templates
- **Current flow:** File pick → upload raw file → set preview URL → Save button → DB update
- **Upload location:** Supabase `post-media` bucket, path `branding/<timestamp>.<ext>`

## Decision: Crop then Upload (Option 1)
File selected → crop modal → canvas blob → upload cropped blob → existing Save flow unchanged.
Only the cropped result is stored; no wasted storage on originals.

## New Files

### `src/lib/cropImage.js`
~25-line pure canvas utility:
```js
export async function getCroppedImg(imageSrc, pixelCrop): Promise<Blob>
```
- Creates an off-screen `<canvas>` sized to `pixelCrop.width × pixelCrop.height`
- Draws the cropped region from the source image
- Returns `canvas.toBlob('image/png')` as a Promise

### `src/components/HorizontalLogoCropDialog.jsx`
shadcn `Dialog` wrapping `react-easy-crop`.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `open` | boolean | Dialog open state |
| `onOpenChange` | fn | Dialog close handler |
| `imageSrc` | string | `objectURL` of the selected file |
| `onCropComplete` | fn(blob) | Called with cropped Blob on Apply |

**Internal state:**
- `crop` — `{ x, y }` position from react-easy-crop
- `zoom` — number 1–3
- `croppedAreaPixels` — stored from react-easy-crop's `onCropComplete` callback

**Layout:**
```
DialogContent (max-w-xl)
├── DialogHeader
│   ├── Title: "Adjust Horizontal Logo"
│   └── Description: "Drag to reposition · Scroll to zoom"
├── AspectRatio (ratio=3/1, relative container for react-easy-crop)
│   └── <Cropper> (react-easy-crop, aspect=3/1, showGrid=false)
├── Zoom row
│   ├── Label "Zoom"
│   └── Slider (min=1 max=3 step=0.05)
└── DialogFooter
    ├── Button variant="ghost" → Cancel
    └── Button → Apply Crop (calls getCroppedImg → onCropComplete)
```

## Changes to `AgencySettings.jsx`

Replace the direct `handleHorizontalLogoUpload` flow:

**Before:** `file → upload → setHorizontalLogoUrl`

**After:**
1. On file pick: `URL.createObjectURL(file)` → `setCropSrc(objectUrl)` → `setIsCropOpen(true)`
2. `HorizontalLogoCropDialog` opens with `cropSrc`
3. On Apply: receive blob → upload blob to Supabase → `setHorizontalLogoUrl(publicUrl)` → `URL.revokeObjectURL(cropSrc)` → close dialog

New state added:
- `cropSrc` — string | null (local objectURL)
- `isCropOpen` — boolean

## Dependencies
- `react-easy-crop` — install via `npm install react-easy-crop`
- shadcn `AspectRatio` — install via shadcn CLI if not present
- shadcn `Slider` — install via shadcn CLI if not present

## Aspect Ratio
Fixed at `3/1` (matches the existing upload area hint: "Recommended 3:1 ratio, e.g. 600×200px").

## Out of Scope
- Rotation controls (explicitly excluded)
- Cropping for the square agency logo upload
- Any changes to the invoice or email rendering
