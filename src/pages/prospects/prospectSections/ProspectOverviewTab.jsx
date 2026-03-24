import {
  Mail,
  Phone,
  Globe,
  MapPin,
  Instagram,
  Linkedin,
  Building2,
  User,
  Tag,
  CalendarDays,
  ExternalLink,
  Trash2,
} from 'lucide-react'

import { PROSPECT_STATUSES, PROSPECT_SOURCES } from '@/api/prospects'
import { INDUSTRY_OPTIONS } from '@/lib/industries'
import { formatDate } from '@/lib/helper'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

// ── InfoRow ───────────────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-start gap-4">
      <div className="mt-0.5 h-9 w-9 shrink-0 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground">
        <Icon size={16} />
      </div>
      <div className="space-y-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className="text-sm text-foreground break-words">{value}</div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProspectOverviewTab({ prospect, onEdit, onDelete }) {
  const industryLabel = prospect.industry
    ? (INDUSTRY_OPTIONS.find((o) => o.value === prospect.industry)?.label ?? prospect.industry)
    : null

  const statusLabel = PROSPECT_STATUSES.find((s) => s.value === prospect.status)?.label ?? prospect.status
  const sourceLabel = PROSPECT_SOURCES.find((s) => s.value === prospect.source)?.label ?? null

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

  const locationDisplay = [prospect.address, prospect.location].filter(Boolean).join(', ') || null

  return (
    <div className="max-w-4xl mx-auto space-y-14 py-4 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── Contact Info ─────────────────────────────────────────────────── */}
      <section className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-normal tracking-tight">Contact Info</h2>
            <p className="text-sm text-muted-foreground font-normal">
              Business details and contact information.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="gap-2 w-fit shrink-0"
          >
            Edit Details
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <InfoRow icon={Building2} label="Business Name" value={prospect.business_name} />
          <InfoRow icon={User} label="Contact Name" value={prospect.contact_name} />
          <InfoRow
            icon={Mail}
            label="Email"
            value={
              prospect.email
                ? (
                  <a
                    href={`mailto:${prospect.email}`}
                    className="hover:text-primary transition-colors flex items-center gap-1 group"
                  >
                    {prospect.email}
                    <ExternalLink className="size-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </a>
                )
                : null
            }
          />
          <InfoRow icon={Phone} label="Phone / WhatsApp" value={prospect.phone} />
          <InfoRow
            icon={Globe}
            label="Website"
            value={
              websiteHref
                ? (
                  <a
                    href={websiteHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors flex items-center gap-1 group truncate"
                  >
                    <span className="truncate">{prospect.website.replace(/(^\w+:|^)\/\//, '')}</span>
                    <ExternalLink className="size-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </a>
                )
                : null
            }
          />
          <InfoRow icon={MapPin} label="Location" value={locationDisplay} />
          <InfoRow
            icon={Instagram}
            label="Instagram"
            value={
              instagramHref
                ? (
                  <a
                    href={instagramHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors flex items-center gap-1 group"
                  >
                    {prospect.instagram}
                    <ExternalLink className="size-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </a>
                )
                : null
            }
          />
          <InfoRow
            icon={Linkedin}
            label="LinkedIn"
            value={
              linkedinHref
                ? (
                  <a
                    href={linkedinHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors flex items-center gap-1 group"
                  >
                    {prospect.linkedin}
                    <ExternalLink className="size-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </a>
                )
                : null
            }
          />
        </div>
      </section>

      <Separator className="opacity-50" />

      {/* ── Pipeline ─────────────────────────────────────────────────────── */}
      <section className="space-y-8">
        <div className="space-y-1">
          <h2 className="text-2xl font-normal tracking-tight">Pipeline</h2>
          <p className="text-sm text-muted-foreground font-normal">
            Lead status, source, and follow-up schedule.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <InfoRow icon={Tag} label="Status" value={statusLabel} />
          <InfoRow icon={Tag} label="Source" value={sourceLabel} />
          <InfoRow icon={Building2} label="Industry" value={industryLabel} />
          <InfoRow
            icon={CalendarDays}
            label="Last Contacted"
            value={prospect.last_contacted_at ? formatDate(prospect.last_contacted_at) : null}
          />
          <InfoRow
            icon={CalendarDays}
            label="Next Follow-up"
            value={prospect.next_followup_at ? formatDate(prospect.next_followup_at) : null}
          />
        </div>
      </section>

      {/* ── Notes ────────────────────────────────────────────────────────── */}
      {prospect.notes && (
        <>
          <Separator className="opacity-50" />
          <section className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-normal tracking-tight">Notes</h2>
              <p className="text-sm text-muted-foreground font-normal">
                Internal notes about this prospect.
              </p>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {prospect.notes}
            </p>
          </section>
        </>
      )}

      <Separator className="opacity-50" />

      {/* ── Danger Zone ──────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-medium text-destructive tracking-tight">Danger Zone</h2>
          <p className="text-sm text-muted-foreground font-normal">
            Irreversible actions. Please proceed with caution.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">Delete Prospect</p>
            <p className="text-xs text-muted-foreground">
              Once deleted, <strong>{prospect.business_name}</strong> and all related activity will be permanently removed.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="gap-2 shrink-0"
            onClick={onDelete}
          >
            <Trash2 size={14} />
            Delete
          </Button>
        </div>
      </section>

    </div>
  )
}
