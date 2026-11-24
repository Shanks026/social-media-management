import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { FolderPlus, Search, Upload, X, Lock, Target } from 'lucide-react'
import { useSubscription } from '@/api/useSubscription'
import { usePermissions } from '@/api/usePermissions'
import { useClients } from '@/api/clients'
import { useProspects } from '@/api/prospects'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import {
  useDocuments,
  useCollections,
  useAllCollections,
  useUploadDocument,
} from '@/api/documents'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty'
import { ClientAvatar } from '@/components/tasks/ClientAvatar'
import {
  DOCUMENT_CATEGORIES,
  PROSPECT_DOCUMENT_CATEGORIES,
} from './UploadMetaDialog'
import DocumentCard from './DocumentCard'
import UploadMetaDialog from './UploadMetaDialog'
import CollectionCard from './CollectionCard'
import CreateCollectionDialog from './CreateCollectionDialog'

const EMPTY_BOX = 'py-20 border border-dashed rounded-2xl bg-muted/5'

/**
 * The one Documents list (spec #208).
 *
 * Scoped by a Client (`clientId`), a Prospect (`prospectId`) or neither (the
 * whole workspace, which adds a Client/Prospect filter and groups collections
 * by Client). Giving both ids is a programming error.
 */
export default function DocumentsTab({ clientId, prospectId }) {
  if (clientId && prospectId) {
    throw new Error('DocumentsTab takes either a clientId or a prospectId, not both')
  }
  const isWorkspace = !clientId && !prospectId

  const { data: sub } = useSubscription()
  const collectionsUnlocked = sub?.documents_collections ?? false
  const { documents: docsLevel } = usePermissions()
  const canManage = docsLevel === 'manage'
  const [searchParams, setSearchParams] = useSearchParams()

  // ── Filters ────────────────────────────────────────────────────────────────
  const [searchRaw, setSearchRaw] = useState('')
  const [search, setSearch] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('ACTIVE')
  const [selectedCategory, setSelectedCategory] = useState('all')
  // Workspace scope only: 'all' | 'client:<id>' | 'prospect:<id>'
  const [target, setTarget] = useState('all')

  // Debounce search 300ms
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchRaw), 300)
    return () => clearTimeout(timer)
  }, [searchRaw])

  // What the list is about, whichever scope or filter chose it.
  const targetClientId = isWorkspace
    ? target.startsWith('client:') ? target.slice('client:'.length) : undefined
    : clientId
  const targetProspectId = isWorkspace
    ? target.startsWith('prospect:') ? target.slice('prospect:'.length) : undefined
    : prospectId

  // Collections belong to Clients, so a Prospect's list has only "All".
  const hasCollections = !targetProspectId
  const categories = targetProspectId
    ? PROSPECT_DOCUMENT_CATEGORIES
    : DOCUMENT_CATEGORIES

  const requestedTab = searchParams.get('doc_tab') ?? 'all'
  const activeTab = hasCollections ? requestedTab : 'all'

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

  // Keep the address bar honest when a Prospect hides the other tabs.
  useEffect(() => {
    if (!hasCollections && requestedTab !== 'all') setTab('all')
  }, [hasCollections, requestedTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const isFilterActive =
    search !== '' ||
    selectedStatus !== 'ACTIVE' ||
    selectedCategory !== 'all' ||
    target !== 'all'
  const onlyArchivedFilter =
    selectedStatus === 'ARCHIVED' &&
    search === '' &&
    selectedCategory === 'all' &&
    target === 'all'

  function clearFilters() {
    setSearchRaw('')
    setSearch('')
    setSelectedStatus('ACTIVE')
    setSelectedCategory('all')
    setTarget('all')
  }

  function changeTarget(next) {
    setTarget(next)
    setSelectedCategory('all') // the category set may differ
  }

  // ── Data ───────────────────────────────────────────────────────────────────
  // The workspace reads everything once and narrows by target here, so the
  // Documents page's heading count reads the same cached list.
  const {
    data: documents,
    isLoading: docsLoading,
    error,
  } = useDocuments(isWorkspace ? {} : { clientId, prospectId })
  const { data: clientCollections, isLoading: clientCollectionsLoading } =
    useCollections(clientId)
  const { data: allCollections, isLoading: allCollectionsLoading } =
    useAllCollections({ enabled: isWorkspace })

  const { data: clientsData } = useClients()
  const internalAccount = clientsData?.internalAccount
  const realClients = clientsData?.realClients ?? []
  const { data: prospectsData } = useProspects()
  const prospects = prospectsData ?? []

  // ── Upload ────────────────────────────────────────────────────────────────
  const [pendingFile, setPendingFile] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false)

  const uploadMutation = useUploadDocument({
    onMutate: () => setUploadProgress(10),
    onSuccess: () => {
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

  function handleOpenUpload() {
    setPendingFile(null)
    setDialogOpen(true)
  }

  function handleFileSelected(file) {
    setPendingFile(file)
  }

  // In the workspace scope the dialog's own picker names the owner; in a
  // Client or Prospect scope the owner is the scope.
  function handleConfirmUpload({
    displayName,
    category,
    notes,
    isConfidential,
    clientId: pickedClientId,
    prospectId: pickedProspectId,
  }) {
    if (!pendingFile) return
    setUploadProgress(30)
    uploadMutation.mutate({
      clientId: isWorkspace ? pickedClientId : clientId,
      prospectId: isWorkspace ? pickedProspectId : prospectId,
      file: pendingFile,
      displayName,
      category,
      notes,
      isConfidential,
    })
  }

  function handleDialogClose(open) {
    if (!open && uploadProgress === null) {
      setDialogOpen(false)
      setPendingFile(null)
    }
  }

  if (docsLoading || clientCollectionsLoading || allCollectionsLoading) {
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

  // ── Derived lists ──────────────────────────────────────────────────────────
  const allDocs = (documents ?? []).filter((d) => {
    if (!isWorkspace) return true
    if (targetClientId) return d.client_id === targetClientId
    if (targetProspectId) return d.prospect_id === targetProspectId
    return true
  })

  const collections = !hasCollections
    ? []
    : isWorkspace
      ? (allCollections ?? []).filter(
          (c) => !targetClientId || c.client_id === targetClientId,
        )
      : (clientCollections ?? [])
  const collectionIds = new Set(collections.map((c) => c.id))

  function applyFilters(docs) {
    return docs.filter((doc) => {
      if (selectedStatus !== 'all' && doc.status !== selectedStatus)
        return false
      if (selectedCategory !== 'all' && doc.category !== selectedCategory)
        return false
      if (
        search &&
        !doc.display_name.toLowerCase().includes(search.toLowerCase())
      )
        return false
      return true
    })
  }

  const filteredDocs = applyFilters(allDocs)
  const ungroupedDocs = applyFilters(
    allDocs.filter(
      (d) => !d.collection_id || !collectionIds.has(d.collection_id),
    ),
  )
  const archivedCount = allDocs.filter((d) => d.status === 'ARCHIVED').length

  // Workspace scope with no Client picked: collections sit under their Client.
  const groupByClient = isWorkspace && !targetClientId
  const collectionGroups = (() => {
    const groups = {}
    for (const col of collections) {
      groups[col.client_id] ??= {
        clientId: col.client_id,
        client: col.clients ?? { name: 'Unknown' },
        collections: [],
      }
      groups[col.client_id].collections.push(col)
    }
    return Object.values(groups)
  })()

  // ── Pieces ─────────────────────────────────────────────────────────────────
  const newCollectionButton = (variant = 'secondary', size = 'default') =>
    collectionsUnlocked ? (
      <Button
        variant={variant}
        size={size}
        className="gap-2"
        onClick={() => setCreateCollectionOpen(true)}
      >
        <FolderPlus className="size-4" />
        New Collection
      </Button>
    ) : (
      <Tooltip>
        <TooltipTrigger asChild>
          {/* A disabled button swallows hover, so the span carries the tooltip. */}
          <span tabIndex={0} className="inline-flex">
            <Button
              variant={variant}
              size={size}
              className="gap-2 opacity-50 cursor-not-allowed"
              disabled
            >
              <FolderPlus className="size-4" />
              New Collection
              <Lock size={12} />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Collections are available on Velocity and above
        </TooltipContent>
      </Tooltip>
    )

  const countChip = (n) => (
    <span className="tabular-nums text-xs text-muted-foreground">{n}</span>
  )

  const clearFiltersLink = (
    <EmptyContent className="mt-4">
      <Button
        variant="link"
        onClick={clearFilters}
        className="text-primary font-medium"
      >
        Clear filters
      </Button>
    </EmptyContent>
  )

  const sectionLabel = (text) => (
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
      {text}
    </p>
  )

  const collectionCard = (col) => (
    <CollectionCard
      key={col.id}
      collection={col}
      documents={applyFilters(allDocs.filter((d) => d.collection_id === col.id))}
      locked={!collectionsUnlocked}
      canManage={canManage}
    />
  )

  const collectionCards = groupByClient ? (
    <div className="space-y-8">
      {collectionGroups.map((group) => (
        <div key={group.clientId} className="space-y-3">
          <div className="flex items-center gap-2">
            <ClientAvatar client={group.client} size="sm" />
            {sectionLabel(group.client.name)}
          </div>
          {group.collections.map(collectionCard)}
        </div>
      ))}
    </div>
  ) : (
    <div className="space-y-3">{collections.map(collectionCard)}</div>
  )

  const documentCards = (docs) =>
    docs.map((doc) => (
      <DocumentCard key={doc.id} doc={doc} canManage={canManage} />
    ))

  const uploadDefaultTarget = isWorkspace
    ? target !== 'all'
      ? target
      : internalAccount?.id
        ? `client:${internalAccount.id}`
        : undefined
    : undefined

  return (
    <>
      <Tabs value={activeTab} onValueChange={setTab} className="mt-4">
        <TabsList variant="underline">
          <TabsTrigger value="all">All {countChip(filteredDocs.length)}</TabsTrigger>
          {hasCollections && (
            <>
              <TabsTrigger value="collections">
                Collections {countChip(collections.length)}
              </TabsTrigger>
              <TabsTrigger value="ungrouped">
                Ungrouped {countChip(ungroupedDocs.length)}
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* ── Filters + actions ── */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchRaw}
              onChange={(e) => setSearchRaw(e.target.value)}
              placeholder="Search documents…"
              className="pl-8 h-9 w-52 text-sm"
            />
          </div>

          {isWorkspace && (
            <Select value={target} onValueChange={changeTarget}>
              <SelectTrigger
                aria-label="Client or prospect"
                className="w-[190px] h-9 text-sm"
              >
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {internalAccount && (
                  <SelectGroup>
                    <SelectLabel>Workspace</SelectLabel>
                    <SelectItem value={`client:${internalAccount.id}`}>
                      <div className="flex items-center gap-2">
                        <ClientAvatar client={internalAccount} size="sm" />
                        <span className="truncate">{internalAccount.name}</span>
                      </div>
                    </SelectItem>
                  </SelectGroup>
                )}
                {realClients.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Clients</SelectLabel>
                    {realClients.map((c) => (
                      <SelectItem key={c.id} value={`client:${c.id}`}>
                        <div className="flex items-center gap-2">
                          <ClientAvatar client={c} size="sm" />
                          <span className="truncate">{c.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {prospects.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Prospects</SelectLabel>
                    {prospects.map((p) => (
                      <SelectItem key={p.id} value={`prospect:${p.id}`}>
                        <div className="flex items-center gap-2">
                          <Target className="size-4 text-muted-foreground" />
                          <span className="truncate">{p.business_name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          )}

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger aria-label="Status" className="w-[130px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger aria-label="Category" className="w-[155px] h-9 text-sm">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((cat) => (
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
              className="h-9 gap-1.5 text-muted-foreground"
              onClick={clearFilters}
            >
              <X className="size-3.5" /> Clear filters
            </Button>
          )}

          {canManage && (
            <div className="ml-auto flex items-center gap-2 shrink-0">
              {hasCollections && newCollectionButton()}
              <Button
                className="gap-2"
                onClick={handleOpenUpload}
                disabled={uploadMutation.isPending}
              >
                <Upload className="size-4" />
                Upload Document
              </Button>
            </div>
          )}
        </div>

        <div className="mt-4">
          {/* All */}
          <TabsContent value="all" className="space-y-4">
            {filteredDocs.length === 0 ? (
              isFilterActive ? (
                <Empty className={EMPTY_BOX}>
                  <EmptyHeader>
                    <div className="text-4xl leading-none select-none mb-2">
                      {onlyArchivedFilter ? '📁' : '🔍'}
                    </div>
                    <EmptyTitle className="font-bold text-xl">
                      {onlyArchivedFilter
                        ? 'No archived documents'
                        : 'No documents match your filters'}
                    </EmptyTitle>
                    <EmptyDescription className="font-normal">
                      {onlyArchivedFilter
                        ? 'No documents have been archived yet.'
                        : 'Try adjusting your filters or search terms.'}
                    </EmptyDescription>
                  </EmptyHeader>
                  {!onlyArchivedFilter && clearFiltersLink}
                </Empty>
              ) : (
                <Empty className={EMPTY_BOX}>
                  <EmptyHeader>
                    <div className="text-4xl leading-none select-none mb-2">📁</div>
                    <EmptyTitle className="font-bold text-xl">
                      {archivedCount > 0 ? 'No active documents' : 'No documents yet'}
                    </EmptyTitle>
                    <EmptyDescription className="font-normal">
                      {archivedCount > 0
                        ? `You have ${archivedCount} archived document${archivedCount !== 1 ? 's' : ''}.`
                        : targetProspectId
                          ? 'Upload a brief, one-pager, or any file related to this prospect.'
                          : 'Upload a contract, brief, or brand asset to get started.'}
                    </EmptyDescription>
                  </EmptyHeader>
                  {archivedCount > 0 && (
                    <EmptyContent className="mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedStatus('ARCHIVED')}
                      >
                        View archived ({archivedCount})
                      </Button>
                    </EmptyContent>
                  )}
                </Empty>
              )
            ) : (
              <>
                {collections.length > 0 && (
                  <div className="space-y-3">
                    {sectionLabel('Collections')}
                    {collectionCards}
                  </div>
                )}
                {ungroupedDocs.length > 0 && (
                  <div className="space-y-3">
                    {collections.length > 0 && sectionLabel('Ungrouped')}
                    <div className="space-y-2">{documentCards(ungroupedDocs)}</div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {hasCollections && (
            <>
              {/* Collections */}
              <TabsContent value="collections" className="space-y-3">
                {collections.length === 0 ? (
                  <Empty className={EMPTY_BOX}>
                    <EmptyHeader>
                      <div className="text-4xl leading-none select-none mb-2">📁</div>
                      <EmptyTitle className="font-bold text-xl">
                        No collections yet
                      </EmptyTitle>
                      <EmptyDescription className="font-normal">
                        Create a collection to group related documents.
                      </EmptyDescription>
                    </EmptyHeader>
                    {canManage && (
                      <EmptyContent className="mt-4">
                        {newCollectionButton('outline', 'sm')}
                      </EmptyContent>
                    )}
                  </Empty>
                ) : (
                  collectionCards
                )}
              </TabsContent>

              {/* Ungrouped */}
              <TabsContent value="ungrouped">
                {ungroupedDocs.length === 0 ? (
                  isFilterActive ? (
                    <Empty className={EMPTY_BOX}>
                      <EmptyHeader>
                        <div className="text-4xl leading-none select-none mb-2">🔍</div>
                        <EmptyTitle className="font-bold text-xl">
                          No ungrouped documents match your filters
                        </EmptyTitle>
                        <EmptyDescription className="font-normal">
                          Try adjusting your filters or search terms.
                        </EmptyDescription>
                      </EmptyHeader>
                      {clearFiltersLink}
                    </Empty>
                  ) : (
                    <Empty className="py-12 border border-dashed rounded-2xl bg-muted/5">
                      <EmptyHeader>
                        <div className="text-4xl leading-none select-none mb-2">📁</div>
                        <EmptyTitle className="font-bold text-xl">
                          No ungrouped documents
                        </EmptyTitle>
                        <EmptyDescription className="font-normal">
                          All documents are organised into collections.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )
                ) : (
                  <div className="space-y-2">{documentCards(ungroupedDocs)}</div>
                )}
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>

      {/* ── Dialogs ── */}
      <UploadMetaDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        file={pendingFile}
        onFileSelected={handleFileSelected}
        onConfirm={handleConfirmUpload}
        uploadProgress={uploadProgress}
        categories={categories}
        showClientSelector={isWorkspace}
        defaultClientId={uploadDefaultTarget}
      />
      {hasCollections && (
        <CreateCollectionDialog
          open={createCollectionOpen}
          onOpenChange={setCreateCollectionOpen}
          clientId={targetClientId}
          showClientSelector={isWorkspace && !targetClientId}
          internalAccount={internalAccount}
          realClients={realClients}
          defaultClientId={targetClientId ?? internalAccount?.id}
          onSuccess={() => setTab('collections')}
        />
      )}
    </>
  )
}
