import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  FolderOpen,
  FolderPlus,
  Search,
  X,
  Building2,
  Lock,
} from 'lucide-react'
import { useHeader } from '@/components/misc/header-context'
import { useAuth } from '@/context/AuthContext'
import { useClients } from '@/api/clients'
import { useSubscription } from '@/api/useSubscription'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip'
import {
  useDocuments,
  useAllCollections,
  uploadDocument,
} from '@/api/documents'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClientAvatar } from '@/components/NoteRow'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import DocumentCard from '@/components/documents/DocumentCard'
import DocumentUploadZone from '@/components/documents/DocumentUploadZone'
import UploadMetaDialog, {
  DOCUMENT_CATEGORIES,
} from '@/components/documents/UploadMetaDialog'
import CollectionCard from '@/components/documents/CollectionCard'
import CreateCollectionDialog from '@/components/documents/CreateCollectionDialog'

export default function DocumentsPage() {
  const { setHeader } = useHeader()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab = searchParams.get('doc_tab') ?? 'all'

  function setTab(tab) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('doc_tab', tab)
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  }

  useEffect(() => {
    setHeader({
      title: 'Documents',
      breadcrumbs: [
        { label: 'Operations', href: '/operations' },
        { label: 'Documents', href: '/documents' },
      ],
    })
  }, [setHeader])

  // ── Subscription ─────────────────────────────────────────────────────────────
  const { data: sub } = useSubscription()
  const collectionsUnlocked = sub?.documents_collections ?? false

  // ── Clients ──────────────────────────────────────────────────────────────────
  const { data: clientsData } = useClients()
  const internalAccount = clientsData?.internalAccount
  const realClients = clientsData?.realClients ?? []

  // ── Filters ───────────────────────────────────────────────────────────────────
  const [selectedClientId, setSelectedClientId] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [searchRaw, setSearchRaw] = useState('')
  const [search, setSearch] = useState('')

  // Debounce search 300ms
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchRaw), 300)
    return () => clearTimeout(timer)
  }, [searchRaw])

  const activeClientId =
    selectedClientId !== 'all' ? selectedClientId : undefined
  const isFilterActive =
    selectedClientId !== 'all' ||
    selectedCategory !== 'all' ||
    selectedStatus !== 'all' ||
    search !== ''

  function clearFilters() {
    setSelectedClientId('all')
    setSelectedCategory('all')
    setSelectedStatus('all')
    setSearchRaw('')
    setSearch('')
  }

  // ── Documents + Collections queries ───────────────────────────────────────────
  const {
    data: documents,
    isLoading: docsLoading,
    error,
  } = useDocuments({
    clientId: activeClientId,
  })
  const { data: allCollections, isLoading: collectionsLoading } =
    useAllCollections()

  // Scope collections to selected client if one is active
  const collections = activeClientId
    ? (allCollections ?? []).filter((c) => c.client_id === activeClientId)
    : (allCollections ?? [])

  // Client-side doc filters
  const filteredDocs = (documents ?? []).filter((doc) => {
    if (selectedStatus !== 'all' && doc.status !== selectedStatus) return false
    if (selectedCategory !== 'all' && doc.category !== selectedCategory)
      return false
    if (
      search &&
      !doc.display_name.toLowerCase().includes(search.toLowerCase())
    )
      return false
    return true
  })

  const archivedCount = (documents ?? []).filter(
    (d) => d.status === 'Archived',
  ).length

  const ungroupedDocs = filteredDocs.filter((d) => !d.collection_id)

  // Group collections by client for the "all clients" view
  const collectionsByClient = (() => {
    if (activeClientId) return null // flat view when client selected
    const groups = {}
    for (const col of collections) {
      if (!groups[col.client_id]) {
        groups[col.client_id] = {
          clientId: col.client_id,
          clientName: col.clients?.name ?? 'Unknown',
          logoUrl: col.clients?.logo_url ?? null,
          collections: [],
        }
      }
      groups[col.client_id].collections.push(col)
    }
    return Object.values(groups)
  })()

  // ── Upload ────────────────────────────────────────────────────────────────────
  const [pendingFile, setPendingFile] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false)

  const uploadMutation = useMutation({
    mutationFn: ({ file, displayName, category, clientId, notes }) =>
      uploadDocument({ clientId, file, displayName, category, notes }),
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

  function handleConfirmUpload({ displayName, category, clientId, notes }) {
    if (!pendingFile) return
    setUploadProgress(30)
    uploadMutation.mutate({
      file: pendingFile,
      displayName,
      category,
      clientId,
      notes,
    })
  }

  function handleDialogClose(open) {
    if (!open && uploadProgress === null) {
      setDialogOpen(false)
      setPendingFile(null)
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────────
  if (docsLoading || collectionsLoading) {
    return (
      <div className="min-h-full bg-background">
        <div className="px-8 pt-8 pb-20 space-y-8 max-w-[1400px] mx-auto animate-pulse">
          <div className="flex items-end justify-between">
            <div className="space-y-2">
              <Skeleton className="h-9 w-52 rounded-md" />
              <Skeleton className="h-4 w-72 rounded-md" />
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Skeleton className="h-9 w-52 rounded-md" />
            <Skeleton className="h-9 w-44 rounded-md" />
            <Skeleton className="h-9 w-40 rounded-md" />
            <Skeleton className="h-9 w-36 rounded-md" />
          </div>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-background selection:bg-primary/10">
      <div className="px-8 pt-8 pb-20 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
        {/* ── SECTION 1: HEADER ── */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-normal tracking-tight text-foreground">
              Documents{' '}
              {filteredDocs.length > 0 && (
                <span className="text-muted-foreground/50 ml-2 font-extralight">
                  {filteredDocs.length}
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground font-normal">
              All documents across your clients and workspace.
            </p>
          </div>

          <TooltipProvider>
            {collectionsUnlocked ? (
              <Button
                variant="outline"
                onClick={() => setCreateCollectionOpen(true)}
                className="gap-2 h-9"
              >
                <FolderPlus className="size-4" />
                New Collection
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2 opacity-50 cursor-not-allowed h-9"
                    disabled
                  >
                    <FolderPlus className="size-4" />
                    New Collection
                    <Lock size={12} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Upgrade to unlock Collections</TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>

        <Tabs value={activeTab} onValueChange={setTab}>
          {/* ── SECTION 2: FILTERS ── */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={searchRaw}
                onChange={(e) => setSearchRaw(e.target.value)}
                placeholder="Search documents…"
                className="pl-8 h-9 w-52 text-sm"
              />
            </div>

            {/* Client */}
            <Select
              value={selectedClientId}
              onValueChange={(v) => setSelectedClientId(v)}
            >
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {internalAccount && (
                  <SelectItem value={internalAccount.id}>
                    <div className="flex items-center gap-2">
                      <ClientAvatar client={internalAccount} size="sm" />
                      <span className="truncate">{internalAccount.name}</span>
                    </div>
                  </SelectItem>
                )}
                {realClients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <ClientAvatar client={c} size="sm" />
                      <span className="truncate">{c.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status */}
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Archived">Archived</SelectItem>
                <SelectItem value="all">All statuses</SelectItem>
              </SelectContent>
            </Select>

            {/* Category */}
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-[165px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isFilterActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-1.5 text-muted-foreground"
              >
                <X className="size-3.5" />
                Clear filters
              </Button>
            )}

            <div className="ml-auto flex items-center gap-3 shrink-0">
              <TabsList>
                <TabsTrigger value="all">
                  All
                  <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                    {filteredDocs.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="collections">
                  Collections
                  <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                    {collections.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="ungrouped">
                  Ungrouped
                  <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                    {ungroupedDocs.length}
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* ── SECTION 3: UPLOAD ZONE ── */}
          <div className="mt-8">
            <DocumentUploadZone
              onFileSelected={handleFileSelected}
              disabled={uploadMutation.isPending}
            />
          </div>

          {/* ── SECTION 4: DOCUMENT LIST ── */}
          <div className="mt-8">
            {error ? (
              <p className="text-sm text-destructive">
                Failed to load documents: {error.message}
              </p>
            ) : (
              <>
                {/* ── ALL ── */}
                <TabsContent value="all" className="mt-0">
                  {filteredDocs.length === 0 ? (
                    <Empty className="py-20 border border-dashed rounded-2xl bg-muted/5">
                      <EmptyContent>
                        <EmptyMedia variant="icon">
                          {isFilterActive ? (
                            <Search className="size-6 text-muted-foreground/60" />
                          ) : (
                            <FolderOpen className="size-6 text-muted-foreground/60" />
                          )}
                        </EmptyMedia>
                        <EmptyHeader>
                          <EmptyTitle className="font-normal text-xl">
                            {isFilterActive
                              ? selectedStatus === 'Active' ||
                                selectedStatus === 'all'
                                ? 'No documents match your filters'
                                : 'No archived documents'
                              : 'No active documents'}
                          </EmptyTitle>
                          <EmptyDescription className="font-normal">
                            {isFilterActive
                              ? selectedStatus === 'Archived'
                                ? 'No documents have been archived yet.'
                                : "Adjust your filters to find what you're looking for."
                              : archivedCount > 0
                                ? `You have ${archivedCount} archived document${archivedCount !== 1 ? 's' : ''}.`
                                : 'Upload a contract, brief, or brand asset to keep everything in one place.'}
                          </EmptyDescription>
                        </EmptyHeader>
                        {isFilterActive && selectedStatus !== 'Archived' && (
                          <Button
                            variant="link"
                            onClick={clearFilters}
                            className="text-primary font-medium"
                          >
                            Clear all filters
                          </Button>
                        )}
                        {!isFilterActive && archivedCount > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedStatus('Archived')}
                            className="mt-2"
                          >
                            View archived ({archivedCount})
                          </Button>
                        )}
                      </EmptyContent>
                    </Empty>
                  ) : (
                    <div className="space-y-2 animate-in fade-in duration-500">
                      {filteredDocs.map((doc) => (
                        <DocumentCard key={doc.id} doc={doc} />
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ── COLLECTIONS ── */}
                <TabsContent value="collections" className="mt-0 space-y-4">
                  {!collectionsUnlocked && (
                    <div className="rounded-lg border border-border/50 bg-muted/30 px-4 py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <Lock
                          size={14}
                          className="text-muted-foreground shrink-0"
                        />
                        <p className="text-sm text-muted-foreground">
                          Organise your documents into collections. Available on
                          Velocity and above.
                        </p>
                      </div>
                      <Link
                        to="/billing"
                        className="text-sm font-medium text-primary hover:underline shrink-0"
                      >
                        Upgrade your plan →
                      </Link>
                    </div>
                  )}
                  {collections.length === 0 ? (
                    <Empty className="py-20 border border-dashed rounded-2xl bg-muted/5">
                      <EmptyContent>
                        <EmptyMedia variant="icon">
                          <FolderOpen className="size-6 text-muted-foreground/60" />
                        </EmptyMedia>
                        <EmptyHeader>
                          <EmptyTitle className="font-normal text-xl">
                            No collections yet
                          </EmptyTitle>
                          <EmptyDescription className="font-normal">
                            {activeClientId
                              ? 'Open this client\u2019s Documents tab to create a collection.'
                              : 'Open a client\u2019s Documents tab to create collections.'}
                          </EmptyDescription>
                        </EmptyHeader>
                      </EmptyContent>
                    </Empty>
                  ) : activeClientId ? (
                    // Single client - flat list of CollectionCards
                    <div className="space-y-3 animate-in fade-in duration-500">
                      {collections.map((col) => (
                        <CollectionCard
                          key={col.id}
                          collection={col}
                          documents={filteredDocs.filter(
                            (d) => d.collection_id === col.id,
                          )}
                          locked={!collectionsUnlocked}
                        />
                      ))}
                    </div>
                  ) : (
                    // All clients - grouped by client
                    <div className="space-y-8 animate-in fade-in duration-500">
                      {collectionsByClient.map((group) => (
                        <div key={group.clientId} className="space-y-3">
                          <div className="flex items-center gap-2">
                            {group.logoUrl ? (
                              <img
                                src={group.logoUrl}
                                alt=""
                                className="size-5 rounded-full object-cover ring-1 ring-border"
                              />
                            ) : (
                              <div className="size-5 rounded-full bg-muted flex items-center justify-center ring-1 ring-border">
                                <Building2 className="size-3 text-muted-foreground" />
                              </div>
                            )}
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              {group.clientName}
                            </p>
                          </div>
                          {group.collections.map((col) => (
                            <CollectionCard
                              key={col.id}
                              collection={col}
                              documents={filteredDocs.filter(
                                (d) => d.collection_id === col.id,
                              )}
                              locked={!collectionsUnlocked}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ── UNGROUPED ── */}
                <TabsContent value="ungrouped" className="mt-0">
                  {ungroupedDocs.length === 0 ? (
                    <Empty className="border">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          {isFilterActive ? <Search /> : <FolderOpen />}
                        </EmptyMedia>
                        <EmptyTitle>
                          {isFilterActive
                            ? 'No ungrouped documents match your filters'
                            : 'No ungrouped documents'}
                        </EmptyTitle>
                        <EmptyDescription>
                          {isFilterActive
                            ? "Adjust your filters to find what you're looking for."
                            : 'All documents are organised into collections.'}
                        </EmptyDescription>
                      </EmptyHeader>
                      {isFilterActive && (
                        <EmptyContent className="mt-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                            className="gap-1.5"
                          >
                            <X className="size-3.5" /> Clear all filters
                          </Button>
                        </EmptyContent>
                      )}
                    </Empty>
                  ) : (
                    <div className="space-y-2 animate-in fade-in duration-500">
                      {ungroupedDocs.map((doc) => (
                        <DocumentCard key={doc.id} doc={doc} />
                      ))}
                    </div>
                  )}
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </div>

      {/* ── New Collection dialog ── */}
      <CreateCollectionDialog
        open={createCollectionOpen}
        onOpenChange={setCreateCollectionOpen}
        clientId={activeClientId}
        showClientSelector={!activeClientId}
        internalAccount={internalAccount}
        realClients={realClients}
        defaultClientId={activeClientId ?? internalAccount?.id}
        onSuccess={() => setTab('collections')}
      />

      {/* ── Upload dialog with client selector ── */}
      <UploadMetaDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        file={pendingFile}
        onConfirm={handleConfirmUpload}
        uploadProgress={uploadProgress}
        showClientSelector={true}
        defaultClientId={internalAccount?.id}
      />
    </div>
  )
}
