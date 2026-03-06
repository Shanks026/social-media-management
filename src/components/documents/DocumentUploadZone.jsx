import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MAX_DOCUMENT_SIZE_BYTES } from '@/lib/helper'
import { toast } from 'sonner'

const ACCEPTED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.png', '.jpg', '.jpeg', '.gif',
  '.zip', '.mp4', '.mov',
]

/**
 * Drag-and-drop area + file picker button.
 *
 * Props:
 *   onFileSelected — (file: File) => void
 *   disabled       — boolean
 *   compact        — boolean — smaller layout for use inside collection cards
 */
export default function DocumentUploadZone({ onFileSelected, disabled, compact = false }) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  function validateAndEmit(file) {
    if (!file) return

    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      toast.error(`File too large. Maximum size is 50 MB.`)
      return
    }

    onFileSelected(file)
  }

  function handleInputChange(e) {
    const file = e.target.files?.[0]
    validateAndEmit(file)
    // Reset so same file can be re-selected
    e.target.value = ''
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    validateAndEmit(file)
  }

  function handleDragOver(e) {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  if (compact) {
    return (
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'flex items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-2.5 transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-muted-foreground/40',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <span className="text-xs text-muted-foreground">Drop a file or click to upload into this collection</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="shrink-0 h-7 text-xs"
        >
          <Upload className="size-3" /> Choose file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className="hidden"
          onChange={handleInputChange}
          disabled={disabled}
        />
      </div>
    )
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors',
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-muted-foreground/40',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
        <Upload className="size-5 text-muted-foreground" />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">Drop a file here or click to browse</p>
        <p className="text-xs text-muted-foreground">
          Max 50 MB
        </p>
        <p className="text-xs text-muted-foreground/60">
          .pdf &middot; .doc .docx &middot; .xls .xlsx &middot; .png .jpg .jpeg .gif &middot; .zip &middot; .mp4 .mov
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        Choose file
      </Button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />
    </div>
  )
}
