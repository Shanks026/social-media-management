import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Globe,
  ExternalLink,
  Pencil,
  PieChart,
  MessageCircle,
  FolderOpen,
  FileText,
  Check,
  ChevronDown,
  UserRoundPlus,
  ArrowUpRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { useProspect, useDeleteProspect, useUpdateProspect, PROSPECT_STATUSES } from '@/api/prospects'
import { useHeader } from '@/components/misc/header-context'
import { ProspectStatusBadge, PROSPECT_STATUS_CONFIG } from '@/components/prospects/ProspectStatusBadge'
import { ProspectSourceBadge } from '@/components/prospects/ProspectSourceBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import ProspectOverviewTab from './prospectSections/ProspectOverviewTab'
import ProspectOutreachTab from './prospectSections/ProspectOutreachTab'
import ProspectDocumentsTab from './prospectSections/ProspectDocumentsTab'
import ProspectProposalsTab from './prospectSections/ProspectProposalsTab'
import EditProspectDialog from '@/components/prospects/EditProspectDialog'
import { ConvertToClientDialog } from '@/components/prospects/ConvertToClientDialog'

// ── Status dot colors ──────────────────────────────────────────────────────────

const STATUS_DOT = {
  new:            'bg-gray-400',
  contacted:      'bg-blue-500',
  follow_up:      'bg-amber-500',
  demo_scheduled: 'bg-violet-500',
  proposal_sent:  'bg-indigo-500',
  won:            'bg-green-500',
  lost:           'bg-red-500',
}

// Button-style trigger colors (match badge palette)
const STATUS_BUTTON_CLASS = {
  new:            'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
  contacted:      'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900',
  follow_up:      'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900',
  demo_scheduled: 'bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:hover:bg-violet-900',
  proposal_sent:  'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900',
  won:            'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-950 dark:text-green-300 dark:hover:bg-green-900',
  lost:           'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900',
}

// ── Tabs config ────────────────────────────────────────────────────────────────

const TABS_CONFIG = [
  { value: 'outreach',  label: 'Outreach',   icon: MessageCircle },
  { value: 'proposals', label: 'Proposals',  icon: FileText },
  { value: 'documents', label: 'Documents',  icon: FolderOpen },
  { value: 'overview',  label: 'Overview',   icon: PieChart },
]

// ── Header skeleton ────────────────────────────────────────────────────────────

function HeaderSkeleton() {
  return (
    <div className="flex items-center gap-5">
      <Skeleton className="size-16 rounded-2xl shrink-0" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-40" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProspectDetailPage() {
  const { prospectId } = useParams()
  const navigate = useNavigate()
  const { setHeader } = useHeader()
  const [searchParams, setSearchParams] = useSearchParams()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)

  const { data: prospect, isLoading, error } = useProspect(prospectId)
  const deleteProspect = useDeleteProspect()
  const updateProspect = useUpdateProspect()

  async function handleStatusChange(newStatus) {
    if (!prospect || newStatus === prospect.status) return
    try {
      await updateProspect.mutateAsync({
        id: prospectId,
        status: newStatus,
        _prevStatus: prospect.status,
      })
      toast.success(`Status updated to ${PROSPECT_STATUS_CONFIG[newStatus]?.label ?? newStatus}`)
    } catch (err) {
      toast.error(err.message || 'Failed to update status')
    }
  }

  const activeTab = searchParams.get('tab') || 'outreach'

  useEffect(() => {
    if (prospect) {
      setHeader({
        title: prospect.business_name,
        breadcrumbs: [
          { label: 'Prospects', href: '/prospects' },
          { label: prospect.business_name },
        ],
      })
    }
  }, [prospect, setHeader])

  const handleTabChange = (value) => {
    setSearchParams((prev) => { prev.set('tab', value); return prev }, { replace: true })
  }

  async function handleDelete() {
    try {
      await deleteProspect.mutateAsync(prospectId)
      toast.success('Prospect deleted')
      navigate('/prospects')
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-full bg-background">
        <div className="px-8 pt-6 pb-10 space-y-6 max-w-[1400px] mx-auto">
          <HeaderSkeleton />
        </div>
      </div>
    )
  }

  if (error || !prospect) {
    return (
      <div className="p-8 text-destructive text-sm">
        Could not load prospect. It may have been deleted.
      </div>
    )
  }

  // ── Derived display values ────────────────────────────────────────────────

  const initials = prospect.business_name
    ? prospect.business_name.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : 'PR'

  const websiteHref = prospect.website
    ? prospect.website.startsWith('http') ? prospect.website : `https://${prospect.website}`
    : null

  const instagramHref = prospect.instagram
    ? prospect.instagram.startsWith('http')
      ? prospect.instagram
      : `https://instagram.com/${prospect.instagram.replace('@', '')}`
    : null

  const linkedinHref = prospect.linkedin
    ? prospect.linkedin.startsWith('http') ? prospect.linkedin : `https://${prospect.linkedin}`
    : null

  const hasLinks = websiteHref || instagramHref || linkedinHref

  return (
    <div className="min-h-full bg-background selection:bg-primary/10">
      <div className="px-8 pt-6 pb-10 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-700">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="size-16 shrink-0 rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-center shadow-sm">
            <span className="text-xl font-bold text-muted-foreground/70 tracking-tighter select-none">
              {initials}
            </span>
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Title row with source badge inline */}
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-medium tracking-normal text-foreground truncate">
                {prospect.business_name}
              </h1>
              <ProspectSourceBadge source={prospect.source} />
            </div>

            {/* Contact name + email + quick links — single row */}
            {(prospect.contact_name || prospect.email || hasLinks) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {(prospect.contact_name || prospect.email) && (
                  <span className="truncate">
                    {[prospect.contact_name, prospect.email].filter(Boolean).join(' · ')}
                  </span>
                )}

                {(prospect.contact_name || prospect.email) && hasLinks && (
                  <span className="text-border/60 select-none">·</span>
                )}

                {websiteHref && (
                  <a
                    href={websiteHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[13px] hover:text-foreground transition-colors"
                  >
                    <Globe className="size-3.5" />
                    Website
                    <ExternalLink className="size-3 opacity-50" />
                  </a>
                )}
                {instagramHref && (
                  <a
                    href={instagramHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[13px] hover:text-foreground transition-colors"
                  >
                    <img src="/platformIcons/instagram.png" alt="Instagram" className="size-3.5 object-contain" />
                    Instagram
                    <ExternalLink className="size-3 opacity-50" />
                  </a>
                )}
                {linkedinHref && (
                  <a
                    href={linkedinHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[13px] hover:text-foreground transition-colors"
                  >
                    <img src="/platformIcons/linkedin.png" alt="LinkedIn" className="size-3.5 object-contain" />
                    LinkedIn
                    <ExternalLink className="size-3 opacity-50" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'h-8 px-3 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors',
                    STATUS_BUTTON_CLASS[prospect.status] ?? 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {PROSPECT_STATUS_CONFIG[prospect.status]?.label ?? prospect.status}
                  <ChevronDown className="size-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider px-2 py-1">
                  Set Status
                </DropdownMenuLabel>
                {PROSPECT_STATUSES.map((s) => (
                  <DropdownMenuItem
                    key={s.value}
                    onClick={() => handleStatusChange(s.value)}
                    className="gap-2.5"
                  >
                    <span className={cn('size-3 rounded-[3px] shrink-0', STATUS_DOT[s.value] ?? 'bg-muted-foreground')} />
                    <span className="flex-1">{s.label}</span>
                    {prospect.status === s.value && (
                      <Check className="size-3 text-muted-foreground shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>

            {prospect.converted_client_id ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-green-700 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-900 dark:hover:bg-green-950"
                onClick={() => navigate(`/clients/${prospect.converted_client_id}`)}
              >
                <ArrowUpRight className="size-3.5" />
                View Client
              </Button>
            ) : prospect.status === 'won' ? (
              <Button
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setConvertOpen(true)}
              >
                <UserRoundPlus className="size-3.5" />
                Convert to Client
              </Button>
            ) : null}
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="bg-transparent h-auto w-full justify-start rounded-none p-0 gap-12 border-b border-border/40">
            {TABS_CONFIG.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="
                  relative rounded-none bg-transparent px-0 pb-3 pt-0 text-sm font-medium transition-none
                  shadow-none border-b-2 border-transparent text-muted-foreground
                  flex-none w-fit gap-2
                  data-[state=active]:bg-transparent
                  dark:data-[state=active]:bg-transparent
                  data-[state=active]:text-black
                  dark:data-[state=active]:text-white
                  data-[state=active]:border-black
                  dark:data-[state=active]:border-white
                  data-[state=active]:shadow-none
                  data-[state=active]:border-x-0
                  data-[state=active]:border-t-0
                  focus-visible:ring-0
                "
              >
                <tab.icon className="size-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent
            value="overview"
            className="mt-2 focus-visible:ring-0 outline-none data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:duration-300"
          >
            <ProspectOverviewTab
              prospect={prospect}
              onEdit={() => setEditOpen(true)}
              onDelete={() => setDeleteOpen(true)}
            />
          </TabsContent>

          <TabsContent
            value="outreach"
            className="mt-2 focus-visible:ring-0 outline-none data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:duration-300"
          >
            <ProspectOutreachTab prospectId={prospectId} />
          </TabsContent>

          <TabsContent
            value="proposals"
            className="mt-2 focus-visible:ring-0 outline-none data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:duration-300"
          >
            <ProspectProposalsTab prospect={prospect} />
          </TabsContent>

          <TabsContent
            value="documents"
            className="mt-2 focus-visible:ring-0 outline-none data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:duration-300"
          >
            <ProspectDocumentsTab prospectId={prospectId} />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Edit dialog ───────────────────────────────────────────────────── */}
      <EditProspectDialog
        prospect={prospect}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {/* ── Convert to Client dialog ──────────────────────────────────────── */}
      <ConvertToClientDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        prospect={prospect}
      />

      {/* ── Delete dialog ─────────────────────────────────────────────────── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prospect?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <strong>{prospect.business_name}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
