import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteClient, updateClientStatus } from '@/api/clients'
import { toast } from 'sonner'
import { format } from 'date-fns'

// Constants & Helpers
import { INDUSTRY_OPTIONS } from '../../../lib/industries'

// UI Components
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Trash2,
  Mail,
  Phone,
  ShieldCheck,
  Globe,
  Pencil,
  ExternalLink,
  CalendarDays,
  Handshake,
  Archive,
  ArchiveRestore,
} from 'lucide-react'

const CLIENT_TYPE_LABELS = {
  monthly_retainer: 'Monthly Retainer',
  project_based: 'Project-Based',
  campaign_based: 'Campaign-Based',
  one_off: 'One-Off / Ad-hoc',
  advisory: 'Advisory / Consulting',
}


export default function ManagementTab({ client }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)

  const archiveMutation = useMutation({
    mutationFn: (newStatus) => updateClientStatus(client.id, newStatus),
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['client', client.id] })
      toast.success(newStatus === 'ARCHIVED' ? 'Client archived' : 'Client restored')
      if (newStatus === 'ARCHIVED') navigate('/clients')
    },
    onError: () => toast.error('Failed to update client status'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
      queryClient.invalidateQueries({ queryKey: ['internal-client'] })
      toast.success('Client workspace deleted')
      navigate('/clients')
    },
  })

  // Helper to find the correct label from your industry options
  const getIndustryLabel = (value) => {
    const industry = INDUSTRY_OPTIONS.find((opt) => opt.value === value)
    return industry ? industry.label : value || 'Not Specified'
  }


  const tier = client.tier?.toUpperCase() || 'BASIC'
  const platforms = client.platforms || []

  return (
    <div className="max-w-4xl mx-auto space-y-14 py-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* 1. Client Profile Row */}
      <section className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-normal tracking-tight">
              Client Profile
            </h2>
            <p className="text-sm text-muted-foreground font-light">
              {client.description || 'Workspace details and contact information.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/clients/${client.id}/edit`)}
            className="gap-2 w-fit shrink-0"
          >
            <Pencil size={14} />
            Edit Profile
          </Button>
        </div>

        {/* Row 1: Logo */}
        <div className="flex items-start gap-6">
          <div className="relative flex size-28 items-center justify-center rounded-2xl border border-border bg-muted/20 overflow-hidden shadow-sm shrink-0">
            {client.logo_url ? (
              <img
                src={client.logo_url}
                alt={client.name}
                className="size-full object-cover"
              />
            ) : (
              <span className="text-3xl font-bold text-muted-foreground/40">
                {client.name?.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Details */}
        <div className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-xl font-medium tracking-tight">
              {client.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {getIndustryLabel(client.industry)}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
            <InfoRow
              icon={<ShieldCheck size={16} />}
              label="Account Status"
              value={
                <span className={
                  client.status === 'ACTIVE'
                    ? 'text-green-600 font-medium'
                    : client.status === 'ARCHIVED'
                      ? 'text-slate-500 font-medium'
                      : 'text-amber-600 font-medium'
                }>
                  {client.status === 'ACTIVE' ? 'Active' : client.status === 'ARCHIVED' ? 'Archived' : 'Paused'}
                </span>
              }
            />
            <InfoRow
              icon={<ShieldCheck size={16} />}
              label="Account Tier"
              value={<span className="font-medium text-primary">{tier}</span>}
            />
            {client.client_type && (
              <InfoRow
                icon={<Handshake size={16} />}
                label="Engagement Type"
                value={CLIENT_TYPE_LABELS[client.client_type] ?? client.client_type}
              />
            )}
            <InfoRow
              icon={<Mail size={16} />}
              label="Primary Email"
              value={client.email || '—'}
            />
            <InfoRow
              icon={<Phone size={16} />}
              label="Contact Number"
              value={client.mobile_number || '—'}
            />
            <InfoRow
              icon={<Globe size={16} />}
              label="Official Website"
              value={
                client.website ? (
                  <a
                    href={client.website.startsWith('http') ? client.website : `https://${client.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors flex items-center gap-1 group truncate"
                  >
                    <span className="truncate">{client.website.replace(/(^\w+:|^)\/\//, '')}</span>
                    <ExternalLink className="size-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </a>
                ) : (
                  '—'
                )
              }
            />
            <InfoRow
              icon={<CalendarDays size={16} />}
              label="Created"
              value={
                client.created_at ? format(new Date(client.created_at), 'MMMM d, yyyy') : '—'
              }
            />
          </div>
        </div>
      </section>

      <Separator className="opacity-50" />

      {/* 2. Platforms */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-normal tracking-tight">Platforms</h2>
          <p className="text-sm text-muted-foreground font-light">
            Social platforms linked to this workspace.
          </p>
        </div>

        {platforms.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {platforms.map((p) => {
              const pId = p.toLowerCase()
              return (
                <div
                  key={pId}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card/50"
                >
                  <img
                    src={`/platformIcons/${pId === 'google_business' ? 'google_busines' : pId}.png`}
                    alt={p}
                    className="size-4 object-contain"
                  />
                  <span className="text-sm font-medium capitalize">{p.replace('_', ' ')}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm text-muted-foreground py-4">
            <Globe size={16} />
            No platforms configured yet.
          </div>
        )}
      </section>

      <Separator className="opacity-50" />

      {/* 3. Danger Zone */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-medium text-destructive tracking-tight">
            Danger Zone
          </h2>
          <p className="text-sm text-muted-foreground font-light">
            Irreversible actions. Please proceed with caution.
          </p>
        </div>

        {/* Archive / Restore */}
        {client.status !== 'ARCHIVED' ? (
          <div className="flex items-center justify-between rounded-xl border border-border px-5 py-4">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">Archive Client</p>
              <p className="text-xs text-muted-foreground">
                Hide {client.name} from the active clients list. All data is preserved and can be restored.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => setArchiveDialogOpen(true)}
              disabled={archiveMutation.isPending}
            >
              <Archive size={14} />
              Archive
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-border px-5 py-4">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">Restore Client</p>
              <p className="text-xs text-muted-foreground">
                Move {client.name} back to the active clients list.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => archiveMutation.mutate('ACTIVE')}
              disabled={archiveMutation.isPending}
            >
              <ArchiveRestore size={14} />
              Restore
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">
              Delete Workspace
            </p>
            <p className="text-xs text-muted-foreground">
              Once deleted, all posts, history, and media for {client.name} will be removed.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="gap-2 shrink-0"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 size={14} />
            Delete
          </Button>
        </div>
      </section>

      {/* Archive Confirmation */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Archive {client.name}?</DialogTitle>
            <DialogDescription>
              This client will be hidden from your active clients list. All data, posts, and history are preserved. You can restore them at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 flex-col sm:flex-row">
            <Button variant="ghost" onClick={() => setArchiveDialogOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto gap-2"
              onClick={() => {
                archiveMutation.mutate('ARCHIVED')
                setArchiveDialogOpen(false)
              }}
              disabled={archiveMutation.isPending}
            >
              <Archive size={14} />
              Archive Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Workspace Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-bold text-foreground">{client.name}</span>?
              You will lose access to all draft and scheduled posts.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 flex-col sm:flex-row">
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={() => deleteMutation.mutate(client.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-4">
      <div className="mt-0.5 h-9 w-9 shrink-0 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div className="space-y-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className="text-sm text-foreground truncate max-w-[200px] sm:max-w-xs">{value}</div>
      </div>
    </div>
  )
}
