import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FolderOpen, Search, X } from 'lucide-react'

import { useDocuments, uploadDocument } from '@/api/documents'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'
import DocumentCard from '@/components/documents/DocumentCard'
import DocumentUploadZone from '@/components/documents/DocumentUploadZone'
import UploadMetaDialog, {
  PROSPECT_DOCUMENT_CATEGORIES,
} from '@/components/documents/UploadMetaDialog'

export default function ProspectDocumentsTab({ prospectId }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: documents, isLoading, error } = useDocuments({ prospectId })

  // ── Filters ──────────────────────────────────────────────────────────────
  const [searchRaw, setSearchRaw] = useState('')
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchRaw), 300)
    return () => clearTimeout(t)
  }, [searchRaw])

  const isFilterActive = search !== '' || selectedCategory !== 'all'

  function clearFilters() {
    setSearchRaw('')
    setSearch('')
    setSelectedCategory('all')
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  const [pendingFile, setPendingFile] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)

  const uploadMutation = useMutation({
    mutationFn: ({ file, displayName, category, notes }) =>
      uploadDocument({ prospectId, file, displayName, category, notes }),
    onMutate: () => setUploadProgress(10),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'list'] })
      setUploadProgress(100)
      setTimeout(() => {
        setUploadProgress(null)
        setDialogOpen(false)
        setPendingFile(null)
      }, 400)
      toast.success('Document uploaded')
    },
    onError: (err) => {
      setUploadProgress(null)
      toast.error(err.message || 'Upload failed')
    },
  })

  function handleFileSelected(file) {
    setPendingFile(file)
    setDialogOpen(true)
  }

  function handleConfirmUpload({ displayName, category, notes }) {
    if (!pendingFile) return
    setUploadProgress(30)
    uploadMutation.mutate({ file: pendingFile, displayName, category, notes })
  }

  function handleDialogClose(open) {
    if (!open && uploadProgress === null) {
      setDialogOpen(false)
      setPendingFile(null)
    }
  }

  // ── States ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="mt-4 space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <p className="mt-4 text-sm text-destructive">
        Failed to load documents: {error.message}
      </p>
    )
  }

  const allDocs = documents ?? []

  const filteredDocs = allDocs.filter((doc) => {
    if (doc.status === 'Archived') return false
    if (selectedCategory !== 'all' && doc.category !== selectedCategory) return false
    if (search && !doc.display_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <>
      <div className="mt-4 space-y-4">
        {/* ── Filters ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchRaw}
              onChange={(e) => setSearchRaw(e.target.value)}
              placeholder="Search documents…"
              className="pl-8 h-9 w-52 text-sm"
            />
          </div>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[155px] h-9 text-sm">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {PROSPECT_DOCUMENT_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isFilterActive && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 text-muted-foreground"
              onClick={clearFilters}
            >
              <X className="size-3.5" /> Clear
            </Button>
          )}
        </div>

        {/* ── Upload zone ── */}
        <DocumentUploadZone
          onFileSelected={handleFileSelected}
          disabled={uploadMutation.isPending}
        />

        {/* ── Document list ── */}
        {filteredDocs.length === 0 ? (
          isFilterActive ? (
            <Empty className="py-20 border border-dashed rounded-2xl bg-muted/5">
              <EmptyHeader>
                <div className="text-4xl leading-none select-none mb-2">🔍</div>
                <EmptyTitle className="font-normal text-xl">No documents match your search</EmptyTitle>
                <EmptyDescription className="font-normal">
                  Try adjusting your filters or search terms.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Empty className="py-20 border border-dashed rounded-2xl bg-muted/5">
              <EmptyHeader>
                <div className="text-4xl leading-none select-none mb-2">📁</div>
                <EmptyTitle className="font-normal text-xl">No documents yet</EmptyTitle>
                <EmptyDescription className="font-normal">
                  Upload a brief, one-pager, or any file related to this prospect.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )
        ) : (
          <div className="space-y-2">
            {filteredDocs.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </div>

      <UploadMetaDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        file={pendingFile}
        onConfirm={handleConfirmUpload}
        uploadProgress={uploadProgress}
        categories={PROSPECT_DOCUMENT_CATEGORIES}
      />
    </>
  )
}
