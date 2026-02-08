import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteClient } from '@/api/clients'
import { toast } from 'sonner'

// Constants & Helpers
import { INDUSTRY_OPTIONS } from '../../../lib/industries'

// UI Components
import { Button } from '@/components/ui/button'
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
  Briefcase,
  Crown,
  Zap,
  Globe,
  Pencil,
  ExternalLink,
  Instagram,
  Linkedin,
  Twitter,
  Facebook,
  Youtube,
  Share2,
} from 'lucide-react'

// Import the standardized Edit Dialog
import EditClient from '../EditClient'

/**
 * Helper to render brand-colored platform icons
 */
const PlatformIcon = ({ name }) => {
  const icons = {
    instagram: {
      icon: <Instagram className="size-3.5 text-white" />,
      bg: 'bg-[#E4405F]',
    },
    linkedin: {
      icon: <Linkedin className="size-3.5 text-white" />,
      bg: 'bg-[#0077B5]',
    },
    twitter: {
      icon: <Twitter className="size-3.5 text-white dark:text-black" />,
      bg: 'bg-black dark:bg-white',
    },
    facebook: {
      icon: <Facebook className="size-3.5 text-white" />,
      bg: 'bg-[#1877F2]',
    },
    youtube: {
      icon: <Youtube className="size-3.5 text-white" />,
      bg: 'bg-[#FF0000]',
    },
    google_business: {
      icon: <Globe className="size-3.5 text-white" />,
      bg: 'bg-yellow-500',
    },
  }

  const platform = icons[name.toLowerCase()]
  if (!platform) return null

  return (
    <div
      className={`flex h-7 w-7 items-center justify-center rounded-full shadow-sm transition-transform hover:scale-110 ${platform.bg}`}
    >
      {platform.icon}
    </div>
  )
}

export default function ManagementTab({ client }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

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

  const DetailItem = ({
    icon: Icon,
    label,
    value,
    colorClass = 'text-foreground',
    isLink = false,
  }) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-muted-foreground/70">
        <Icon className="size-3.5" />
        <span className="text-xs font-bold uppercase tracking-wide">
          {label}
        </span>
      </div>
      {isLink && value ? (
        <a
          href={value.startsWith('http') ? value : `https://${value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold flex items-center gap-1.5 hover:text-primary transition-colors group"
        >
          {value.replace(/(^\w+:|^)\/\//, '')}
          <ExternalLink className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>
      ) : (
        <span className={`text-sm font-semibold truncate ${colorClass}`}>
          {value || 'Not provided'}
        </span>
      )}
    </div>
  )

  const tier = client.tier?.toUpperCase() || 'BASIC'
  const platforms = client.platforms || []

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-4">
      {/* 1. Brand Identity Row */}
      <section className="flex flex-col md:flex-row items-start justify-between gap-6 px-4">
        <div className="flex items-start gap-6">
          <div className="relative h-20 w-20 shrink-0 rounded-2xl border bg-muted/20 flex items-center justify-center overflow-hidden">
            {client.logo_url ? (
              <img
                src={client.logo_url}
                alt={client.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xl font-bold text-muted-foreground/40">
                {client.name?.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="space-y-1.5 py-1">
            <h2 className="text-2xl font-bold tracking-tight">{client.name}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
              {client.description || 'No workspace description provided.'}
            </p>
          </div>
        </div>

        <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="size-3.5 mr-2" />
          Edit Profile
        </Button>
      </section>

      {/* 2. Unified Information Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-x-16 gap-y-10 px-4">
        <DetailItem
          icon={ShieldCheck}
          label="Account Status"
          value={client.status === 'ACTIVE' ? 'Active' : 'Paused'}
          colorClass={
            client.status === 'ACTIVE' ? 'text-green-600' : 'text-amber-600'
          }
        />
        <DetailItem
          icon={tier === 'VIP' ? Crown : tier === 'PRO' ? Zap : Briefcase}
          label="Service Tier"
          value={tier}
          colorClass={
            tier === 'VIP'
              ? 'text-purple-600'
              : tier === 'PRO'
                ? 'text-amber-500'
                : ''
          }
        />

        {/* Industry Sector (Dynamic from helper) */}
        <DetailItem
          icon={Briefcase}
          label="Industry"
          value={getIndustryLabel(client.industry)}
        />

        <DetailItem icon={Mail} label="Primary Email" value={client.email} />

        <DetailItem icon={Phone} label="Contact" value={client.mobile_number} />

        {/* Active Social Channels */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground/70">
            <Share2 className="size-3.5" />
            <span className="text-xs font-bold uppercase tracking-wide">
              Active Channels
            </span>
          </div>
          <div className="flex items-center gap-2">
            {platforms.length > 0 ? (
              platforms.map((p) => <PlatformIcon key={p} name={p} />)
            ) : (
              <span className="text-sm font-semibold text-muted-foreground/50">
                None linked
              </span>
            )}
          </div>
        </div>

        <DetailItem
          icon={Globe}
          label="Official Website"
          value={client.website}
          isLink
        />
      </section>

      <hr className="mx-4 border-dashed opacity-50" />

      {/* 3. Danger Zone */}
      <section className="mx-4 space-y-4">
        <div className="flex items-center gap-3">
          <Trash2 className="size-4 text-destructive" />
          <h3 className="text-sm font-bold text-destructive uppercase tracking-widest">
            Danger Zone
          </h3>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6 rounded-2xl border border-destructive/20 bg-destructive/5">
          <div className="space-y-1">
            <p className="text-base font-bold text-destructive">
              Delete Workspace
            </p>
            <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
              Once deleted, all posts, history, and media for {client.name} will
              be removed from our servers. This action is irreversible.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="h-9 px-6 text-sm font-bold shadow-sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete Permanently
          </Button>
        </div>
      </section>

      {/* Edit Dialog */}
      {editOpen && (
        <EditClient client={client} onClose={() => setEditOpen(false)} />
      )}

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
          <DialogFooter className="mt-4 gap-2">
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
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
