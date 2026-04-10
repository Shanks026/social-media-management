import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getDocumentSignedUrl } from '@/api/documents'
import { formatDate, formatFileSize } from '@/lib/helper'
import DocumentCategoryBadge from './DocumentCategoryBadge'

function isPreviewable(mimeType) {
  if (!mimeType) return false
  return mimeType === 'application/pdf' || mimeType.startsWith('image/')
}

/**
 * Modal for previewing a document inline.
 *
 * Props:
 *   doc          — document object (or null when closed)
 *   onOpenChange — (open: boolean) => void
 */
export default function DocumentPreviewModal({ doc, onOpenChange }) {
  const open = !!doc
  const [signedUrl, setSignedUrl] = useState(null)
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState(null)

  useEffect(() => {
    if (!doc) {
      setSignedUrl(null)
      setUrlError(null)
      return
    }

    setUrlLoading(true)
    setSignedUrl(null)
    setUrlError(null)

    getDocumentSignedUrl(doc.storage_path)
      .then((url) => setSignedUrl(url))
      .catch((err) => setUrlError(err.message || 'Failed to load preview'))
      .finally(() => setUrlLoading(false))
  }, [doc])

  function handleDownload() {
    if (signedUrl) window.open(signedUrl, '_blank', 'noopener,noreferrer')
  }

  const canPreview = doc ? isPreviewable(doc.mime_type) : false
  const isPdf = doc?.mime_type === 'application/pdf'
  const isImage = doc?.mime_type?.startsWith('image/')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl w-full h-[90vh] flex flex-col p-0 gap-0">
        {/* ── Header ── */}
        <DialogHeader className="flex-row items-start justify-between gap-3 px-6 py-4 border-b border-border shrink-0">
          <div className="flex flex-col gap-1 min-w-0">
            <DialogTitle className="text-base font-semibold leading-tight truncate pr-4">
              {doc?.display_name}
            </DialogTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {doc && <DocumentCategoryBadge category={doc.category} />}
              {doc && (
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(doc.file_size_bytes)} &middot; {formatDate(doc.created_at)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!signedUrl}
              className="gap-1.5"
            >
              <Download className="size-3.5" />
              Download
            </Button>
          </div>
        </DialogHeader>

        {/* ── Preview area ── */}
        <div className="flex-1 overflow-hidden bg-muted/30 relative">
          {urlLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full max-w-lg space-y-3 px-8">
                <Skeleton className="h-6 w-3/4 rounded" />
                <Skeleton className="h-96 w-full rounded-lg" />
              </div>
            </div>
          )}

          {urlError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-8">
              <p className="text-sm text-destructive">{urlError}</p>
            </div>
          )}

          {signedUrl && canPreview && isPdf && (
            <iframe
              src={signedUrl}
              title={doc.display_name}
              className="w-full h-full border-0"
            />
          )}

          {signedUrl && canPreview && isImage && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <img
                src={signedUrl}
                alt={doc.display_name}
                className="max-w-full max-h-full object-contain rounded-lg shadow-md"
              />
            </div>
          )}

          {signedUrl && !canPreview && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-8">
              <div className="text-5xl text-muted-foreground/30 select-none">
                {doc?.mime_type?.includes('zip') ? '📦'
                  : doc?.mime_type?.startsWith('video/') ? '🎬'
                  : '📄'}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Preview not available</p>
                <p className="text-xs text-muted-foreground">
                  This file type cannot be previewed in the browser.
                </p>
              </div>
              <Button onClick={handleDownload} className="gap-1.5">
                <Download className="size-4" /> Download to view
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
