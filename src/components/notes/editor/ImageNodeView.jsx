import { useState, useEffect, useRef } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import { ImageIcon, Loader2, X } from 'lucide-react'
import { uploadNoteMedia, getSignedNoteMediaUrl, deleteNoteMedia } from '@/api/noteMedia'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const MAX_BYTES = 50 * 1024 * 1024
const ACCEPTED = 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml'
const ACCEPTED_TYPES = ACCEPTED.split(',')

export default function ImageNodeView({ node, updateAttributes, deleteNode, selected, extension }) {
  const { src, width, alt } = node.attrs
  const noteId = extension.options.noteId

  const [signedUrl, setSignedUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)
  const wrapperRef = useRef(null)
  const startXRef = useRef(0)
  const startWRef = useRef(0)

  useEffect(() => {
    if (!src) return
    let stale = false
    getSignedNoteMediaUrl(src)
      .then((url) => { if (!stale) setSignedUrl(url) })
      .catch(console.error)
    return () => { stale = true }
  }, [src])

  async function handleFile(file) {
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Unsupported image format')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error('Image must be under 50 MB')
      return
    }
    if (!noteId) {
      toast.error('Note not ready — try again in a moment')
      return
    }
    setUploading(true)
    try {
      const path = await uploadNoteMedia(file, noteId)
      updateAttributes({ src: path, alt: file.name })
    } catch (err) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleDelete() {
    if (src) deleteNoteMedia(src).catch(console.error)
    deleteNode()
  }

  function onResizeStart(e, side) {
    e.preventDefault()
    const parentW = wrapperRef.current?.parentElement?.offsetWidth ?? 600
    const curW = width ? (parentW * width) / 100 : parentW
    startXRef.current = e.clientX
    startWRef.current = curW

    function onMove(ev) {
      const delta =
        side === 'right' ? ev.clientX - startXRef.current : startXRef.current - ev.clientX
      const newW = Math.max(80, startWRef.current + delta)
      updateAttributes({ width: Math.round(Math.min(100, (newW / parentW) * 100)) })
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // ── Upload dropzone ──────────────────────────────────────────────────────
  if (!src) {
    return (
      <NodeViewWrapper>
        <div
          contentEditable={false}
          className={cn(
            'my-3 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors cursor-pointer select-none',
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/40 hover:bg-muted/30',
          )}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]) }}
          onClick={() => !uploading && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {uploading ? (
            <>
              <Loader2 className="size-8 text-muted-foreground animate-spin" />
              <p className="text-sm text-muted-foreground">Uploading…</p>
            </>
          ) : (
            <>
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <ImageIcon className="size-5 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Add an image</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Drag & drop or click to browse · Max 50 MB
                </p>
              </div>
            </>
          )}
        </div>
      </NodeViewWrapper>
    )
  }

  // ── Image display ────────────────────────────────────────────────────────
  return (
    <NodeViewWrapper>
      <div
        ref={wrapperRef}
        contentEditable={false}
        className="relative my-3 group"
        style={{ width: width ? `${width}%` : '100%' }}
      >
        {signedUrl ? (
          <img
            src={signedUrl}
            alt={alt || ''}
            draggable={false}
            className={cn(
              'w-full rounded-lg block',
              selected && 'ring-2 ring-primary ring-offset-2',
            )}
          />
        ) : (
          <div className="w-full aspect-video rounded-lg bg-muted animate-pulse" />
        )}

        {/* Delete */}
        <button
          type="button"
          data-media-controls
          contentEditable={false}
          className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-md bg-background/80 border shadow-sm hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
          onClick={handleDelete}
          title="Remove image"
        >
          <X className="size-3.5" />
        </button>

        {/* Resize handles — left */}
        {selected && (
          <div
            data-media-controls
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 size-4 cursor-col-resize rounded-sm bg-background border shadow-sm flex items-center justify-center gap-px opacity-0 group-hover:opacity-100"
            onMouseDown={(e) => onResizeStart(e, 'left')}
          >
            <div className="w-px h-2.5 rounded bg-muted-foreground" />
            <div className="w-px h-2.5 rounded bg-muted-foreground" />
          </div>
        )}

        {/* Resize handles — right */}
        {selected && (
          <div
            data-media-controls
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 size-4 cursor-col-resize rounded-sm bg-background border shadow-sm flex items-center justify-center gap-px opacity-0 group-hover:opacity-100"
            onMouseDown={(e) => onResizeStart(e, 'right')}
          >
            <div className="w-px h-2.5 rounded bg-muted-foreground" />
            <div className="w-px h-2.5 rounded bg-muted-foreground" />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}
