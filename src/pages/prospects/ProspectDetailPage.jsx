import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Globe,
  Instagram,
  Linkedin,
  ExternalLink,
  Pencil,
  Trash2,
  PieChart,
  MessageCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { useProspect, useDeleteProspect } from '@/api/prospects'
import { useHeader } from '@/components/misc/header-context'
import { ProspectStatusBadge } from '@/components/prospects/ProspectStatusBadge'
import { ProspectSourceBadge } from '@/components/prospects/ProspectSourceBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
import EditProspectDialog from '@/components/prospects/EditProspectDialog'

// ── Tabs config ────────────────────────────────────────────────────────────────

const TABS_CONFIG = [
  { value: 'overview', label: 'Overview', icon: PieChart },
  { value: 'outreach', label: 'Outreach', icon: MessageCircle },
  // { value: 'notes',     label: 'Notes',     icon: StickyNote },    // Phase 2c
  // { value: 'meetings',  label: 'Meetings',  icon: Video },         // Phase 2c
  // { value: 'documents', label: 'Documents', icon: FolderOpen },    // Phase 2c
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

  const { data: prospect, isLoading, error } = useProspect(prospectId)
  const deleteProspect = useDeleteProspect()

  const activeTab = searchParams.get('tab') || 'overview'

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
            <h1 className="text-2xl font-medium tracking-normal text-foreground truncate">
              {prospect.business_name}
            </h1>

            {/* Contact name + email */}
            {(prospect.contact_name || prospect.email) && (
              <p className="text-sm text-muted-foreground truncate">
                {[prospect.contact_name, prospect.email].filter(Boolean).join(' · ')}
              </p>
            )}

            {/* Badges + quick links */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <ProspectStatusBadge status={prospect.status} />
              <ProspectSourceBadge source={prospect.source} />

              {hasLinks && (
                <span className="text-border/60 select-none mx-0.5">·</span>
              )}

              {websiteHref && (
                <a
                  href={websiteHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Globe className="size-3" />
                  Website
                  <ExternalLink className="size-2.5 opacity-50" />
                </a>
              )}
              {instagramHref && (
                <a
                  href={instagramHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Instagram className="size-3" />
                  Instagram
                  <ExternalLink className="size-2.5 opacity-50" />
                </a>
              )}
              {linkedinHref && (
                <a
                  href={linkedinHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Linkedin className="size-3" />
                  LinkedIn
                  <ExternalLink className="size-2.5 opacity-50" />
                </a>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {activeTab === 'overview' && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-3.5" />
                Edit
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
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
            <ProspectOverviewTab prospect={prospect} />
          </TabsContent>

          <TabsContent
            value="outreach"
            className="mt-2 focus-visible:ring-0 outline-none data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:duration-300"
          >
            <ProspectOutreachTab prospectId={prospectId} />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Edit dialog ───────────────────────────────────────────────────── */}
      <EditProspectDialog
        prospect={prospect}
        open={editOpen}
        onOpenChange={setEditOpen}
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
