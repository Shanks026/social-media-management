import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FolderOpen, FolderPlus, Search, X, Lock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useSubscription } from '@/api/useSubscription'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useDocuments, useCollections, uploadDocument } from '@/api/documents'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty'
import { DOCUMENT_CATEGORIES } from './UploadMetaDialog'
import DocumentCard from './DocumentCard'
import DocumentUploadZone from './DocumentUploadZone'
import UploadMetaDialog from './UploadMetaDialog'
import CollectionCard from './CollectionCard'
import CreateCollectionDialog from './CreateCollectionDialog'

/**
 * Documents tab for a specific client.
 *
 * Props:
 *   clientId — UUID of the client whose documents to show.
 */
export default function DocumentsTab({ clientId }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: sub } = useSubscription()
  const collectionsUnlocked = sub?.documents_collections ?? false
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('doc_tab') ?? 'all'

  function setTab(tab) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('doc_tab', tab)
        return next
      },
      { replace: true, preventScrollReset: true }
    )
  }

  // Fetch all statuses — filtered client-side
  const { data: documents, isLoading: docsLoading, error } = useDocuments({ clientId })
  const { data: collections, isLoading: collectionsLoading } = useCollections(clientId)

  // ── Filters ────────────────────────────────────────────────────────────────
  const [searchRaw, setSearchRaw] = useState('')
  const [search, setSearch] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('Active')
  const [selectedCategory, setSelectedCategory] = useState('all')

  // Debounce search 300ms
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchRaw), 300)
    return () => clearTimeout(timer)
  }, [searchRaw])

  const isFilterActive =
    search !== '' ||
    selectedStatus !== 'Active' ||
    selectedCategory !== 'all'

  function clearFilters() {
    setSearchRaw('')
    setSearch('')
    setSelectedStatus('Active')
    setSelectedCategory('all')
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  const [pendingFile, setPendingFile] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false)

  const uploadMutation = useMutation({
    mutationFn: ({ file, displayName, category }) =>
      uploadDocument({ userId: user.id, clientId, file, displayName, category }),
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

  function handleConfirmUpload({ displayName, category }) {
    if (!pendingFile) return
    setUploadProgress(30)
    uploadMutation.mutate({ file: pendingFile, displayName, category })
  }

  function handleDialogClose(open) {
    if (!open && uploadProgress === null) {
      setDialogOpen(false)
      setPendingFile(null)
    }
  }

  if (docsLoading || collectionsLoading) {
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

  const collectionIds = new Set((collections ?? []).map((c) => c.id))
  const allDocs = documents ?? []

  function applyFilters(docs) {
    return docs.filter((doc) => {
      if (selectedStatus !== 'all' && doc.status !== selectedStatus) return false
      if (selectedCategory !== 'all' && doc.category !== selectedCategory) return false
      if (search && !doc.display_name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }

  const filteredDocs = applyFilters(allDocs)
  const ungroupedDocs = applyFilters(
    allDocs.filter((d) => !d.collection_id || !collectionIds.has(d.collection_id)),
  )
  const filteredCollections = collections ?? []

  return (
    <>
      <Tabs value={activeTab} onValueChange={setTab} className="mt-4 space-y-4">
      {/* ── Row 1: Filters + New Collection ── */}
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

        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-[130px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Archived">Archived</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[155px] h-9 text-sm">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {DOCUMENT_CATEGORIES.map((cat) => (
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

        <div className="ml-auto flex items-center gap-3 shrink-0">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="collections">Collections</TabsTrigger>
            <TabsTrigger value="ungrouped">Ungrouped</TabsTrigger>
          </TabsList>

          {collectionsUnlocked ? (
            <Button className="gap-2" onClick={() => setCreateCollectionOpen(true)}>
              <FolderPlus className="size-4" />
              New Collection
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button className="gap-2 opacity-50 cursor-not-allowed" disabled>
                  <FolderPlus className="size-4" />
                  New Collection
                  <Lock size={12} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Collections are available on Velocity and above</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* ── Row 2: Upload zone ── */}
      <DocumentUploadZone
        onFileSelected={handleFileSelected}
        disabled={uploadMutation.isPending}
      />

      {/* ── Row 3: Content ── */}
      <div className="mt-4">

        {/* All */}
        <TabsContent value="all" className="mt-4 space-y-4">
          {filteredDocs.length === 0 ? (
            isFilterActive ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Search /></EmptyMedia>
                  <EmptyTitle>No documents match your search</EmptyTitle>
                  <EmptyDescription>Try adjusting your filters or search terms.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent className="mt-4">
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5">
                    <X className="size-3.5" /> Clear filters
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><FolderOpen /></EmptyMedia>
                  <EmptyTitle>No documents yet</EmptyTitle>
                  <EmptyDescription>Upload a contract, brief, or brand asset to get started.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )
          ) : (
            <>
              {filteredCollections.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Collections</p>
                  {filteredCollections.map((col) => (
                    <CollectionCard
                      key={col.id}
                      collection={col}
                      documents={applyFilters(allDocs.filter((d) => d.collection_id === col.id))}
                      locked={!collectionsUnlocked}
                    />
                  ))}
                </div>
              )}
              {ungroupedDocs.length > 0 && (
                <div className="space-y-3">
                  {filteredCollections.length > 0 && (
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ungrouped</p>
                  )}
                  <div className="space-y-2">
                    {ungroupedDocs.map((doc) => <DocumentCard key={doc.id} doc={doc} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Collections */}
        <TabsContent value="collections" className="mt-4 space-y-3">
          {filteredCollections.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon"><FolderOpen /></EmptyMedia>
                <EmptyTitle>No collections yet</EmptyTitle>
                <EmptyDescription>Create a collection to group related documents.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="mt-4">
                {collectionsUnlocked ? (
                  <Button size="sm" className="gap-1.5" onClick={() => setCreateCollectionOpen(true)}>
                    <FolderPlus className="size-3.5" /> New Collection
                  </Button>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" className="gap-1.5 opacity-50 cursor-not-allowed" disabled>
                        <FolderPlus className="size-3.5" /> New Collection <Lock size={11} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Collections are available on Velocity and above</TooltipContent>
                  </Tooltip>
                )}
              </EmptyContent>
            </Empty>
          ) : (
            filteredCollections.map((col) => (
              <CollectionCard
                key={col.id}
                collection={col}
                documents={applyFilters(allDocs.filter((d) => d.collection_id === col.id))}
                locked={!collectionsUnlocked}
              />
            ))
          )}
        </TabsContent>

        {/* Ungrouped */}
        <TabsContent value="ungrouped" className="mt-4">
          {ungroupedDocs.length === 0 ? (
            isFilterActive ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Search /></EmptyMedia>
                  <EmptyTitle>No ungrouped documents match your search</EmptyTitle>
                  <EmptyDescription>Try adjusting your filters or search terms.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent className="mt-4">
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5">
                    <X className="size-3.5" /> Clear filters
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4 italic">
                No ungrouped documents.
              </p>
            )
          ) : (
            <div className="space-y-2">
              {ungroupedDocs.map((doc) => <DocumentCard key={doc.id} doc={doc} />)}
            </div>
          )}
        </TabsContent>
      </div>
    </Tabs>

      {/* ── Dialogs ── */}
      <UploadMetaDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        file={pendingFile}
        onConfirm={handleConfirmUpload}
        uploadProgress={uploadProgress}
      />
      <CreateCollectionDialog
        open={createCollectionOpen}
        onOpenChange={setCreateCollectionOpen}
        clientId={clientId}
        onSuccess={() => setTab('collections')}
      />
    </>
  )
}
