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
} from 'lucide-react'

import { PROSPECT_STATUSES, PROSPECT_SOURCES } from '@/api/prospects'
import { INDUSTRY_OPTIONS } from '@/lib/industries'
import { formatDate } from '@/lib/helper'

// ── Read-only field ───────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value, href }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-foreground hover:text-primary transition-colors flex items-center gap-1 break-all"
          >
            {value}
            <ExternalLink className="size-3 opacity-50 shrink-0" />
          </a>
        ) : (
          <p className="text-sm text-foreground break-words">{value}</p>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
      {children}
    </p>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProspectOverviewTab({ prospect }) {
  const industryLabel = prospect.industry
    ? (INDUSTRY_OPTIONS.find((o) => o.value === prospect.industry)?.label ?? prospect.industry)
    : null

  const statusLabel = PROSPECT_STATUSES.find((s) => s.value === prospect.status)?.label ?? prospect.status
  const sourceLabel = PROSPECT_SOURCES.find((s) => s.value === prospect.source)?.label ?? prospect.source

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">

      {/* Left: Contact info */}
      <div className="space-y-1">
        <SectionLabel>Contact Info</SectionLabel>
        <div className="rounded-xl border border-border/50 bg-card divide-y divide-border/40 overflow-hidden">
          <div className="px-4">
            <InfoRow icon={Building2} label="Business Name" value={prospect.business_name} />
          </div>
          {prospect.contact_name && (
            <div className="px-4">
              <InfoRow icon={User} label="Contact Name" value={prospect.contact_name} />
            </div>
          )}
          {prospect.email && (
            <div className="px-4">
              <InfoRow icon={Mail} label="Email" value={prospect.email} href={`mailto:${prospect.email}`} />
            </div>
          )}
          {prospect.phone && (
            <div className="px-4">
              <InfoRow icon={Phone} label="Phone / WhatsApp" value={prospect.phone} />
            </div>
          )}
          {prospect.website && (
            <div className="px-4">
              <InfoRow icon={Globe} label="Website" value={prospect.website} href={websiteHref} />
            </div>
          )}
          {prospect.location && (
            <div className="px-4">
              <InfoRow icon={MapPin} label="Location" value={prospect.location} />
            </div>
          )}
          {prospect.address && (
            <div className="px-4">
              <InfoRow icon={MapPin} label="Address" value={prospect.address} />
            </div>
          )}
          {prospect.instagram && (
            <div className="px-4">
              <InfoRow icon={Instagram} label="Instagram" value={prospect.instagram} href={instagramHref} />
            </div>
          )}
          {prospect.linkedin && (
            <div className="px-4">
              <InfoRow icon={Linkedin} label="LinkedIn" value={prospect.linkedin} href={linkedinHref} />
            </div>
          )}
          {!prospect.contact_name && !prospect.email && !prospect.phone &&
           !prospect.website && !prospect.location && !prospect.instagram && !prospect.linkedin && (
            <div className="px-4 py-4">
              <p className="text-sm text-muted-foreground">No contact details added yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Pipeline + Notes */}
      <div className="space-y-6">
        <div className="space-y-1">
          <SectionLabel>Pipeline</SectionLabel>
          <div className="rounded-xl border border-border/50 bg-card divide-y divide-border/40 overflow-hidden">
            <div className="px-4">
              <InfoRow icon={Tag} label="Status" value={statusLabel} />
            </div>
            {sourceLabel && (
              <div className="px-4">
                <InfoRow icon={Tag} label="Source" value={sourceLabel} />
              </div>
            )}
            {industryLabel && (
              <div className="px-4">
                <InfoRow icon={Building2} label="Industry" value={industryLabel} />
              </div>
            )}
            {prospect.last_contacted_at && (
              <div className="px-4">
                <InfoRow icon={CalendarDays} label="Last Contacted" value={formatDate(prospect.last_contacted_at)} />
              </div>
            )}
            {prospect.next_followup_at && (
              <div className="px-4">
                <InfoRow icon={CalendarDays} label="Next Follow-up" value={formatDate(prospect.next_followup_at)} />
              </div>
            )}
          </div>
        </div>

        {prospect.notes && (
          <div className="space-y-1">
            <SectionLabel>Notes</SectionLabel>
            <div className="rounded-xl border border-border/50 bg-card px-4 py-4">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {prospect.notes}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
