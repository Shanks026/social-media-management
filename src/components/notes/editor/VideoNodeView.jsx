import { useState, useEffect, useRef } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import { Video, Loader2, X } from 'lucide-react'
import { uploadNoteMedia, getSignedNoteMediaUrl, deleteNoteMedia } from '@/api/noteMedia'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const MAX_BYTES = 50 * 1024 * 1024
const ACCEPTED = 'video/mp4,video/webm,video/ogg,video/quicktime'
const ACCEPTED_TYPES = ACCEPTED.split(',')
const WIDTH_PRESETS = [25, 50, 75, 100]

export default function VideoNodeView({ node, updateAttributes, deleteNode, selected, extension }) {
  const { src, width } = node.attrs
  const noteId = extension.options.noteId

  const [signedUrl, setSignedUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

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
      toast.error('Unsupported format — use MP4, WebM, or OGG')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error('Video must be under 50 MB')
      return
    }
    if (!noteId) {
      toast.error('Note not ready — try again in a moment')
      return
    }
    setUploading(true)
    try {
      const path = await uploadNoteMedia(file, noteId)
      updateAttributes({ src: path })
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
                <Video className="size-5 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Add a video</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Drag & drop or click to browse · MP4, WebM, OGG · Max 50 MB
                </p>
              </div>
            </>
          )}
        </div>
      </NodeViewWrapper>
    )
  }

  // ── Video display ────────────────────────────────────────────────────────
  return (
    <NodeViewWrapper>
      <div
        contentEditable={false}
        className="my-3 group"
        style={{ width: `${width ?? 100}%` }}
      >
        {signedUrl ? (
          <video
            src={signedUrl}
            controls
            className={cn(
              'w-full rounded-lg block',
              selected && 'ring-2 ring-primary ring-offset-2',
            )}
          />
        ) : (
          <div className="w-full aspect-video rounded-lg bg-muted animate-pulse" />
        )}

        {/* Width presets + delete — shown when node is selected */}
        {selected && (
          <div data-media-controls contentEditable={false} className="mt-1.5 flex items-center gap-1">
            {WIDTH_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={cn(
                  'px-2 py-0.5 text-xs rounded-md border transition-colors',
                  (width ?? 100) === p
                    ? 'bg-accent border-accent-foreground/20 font-semibold'
                    : 'bg-background hover:bg-muted text-muted-foreground',
                )}
                onClick={() => updateAttributes({ width: p })}
              >
                {p}%
              </button>
            ))}
            <button
              type="button"
              className="ml-auto flex size-6 items-center justify-center rounded-md border bg-background hover:bg-destructive/10 hover:text-destructive transition-colors"
              onClick={handleDelete}
              title="Remove video"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}
