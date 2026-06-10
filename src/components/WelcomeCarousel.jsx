import { useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Send,
  ShieldCheck,
  MousePointer2,
  Megaphone,
  Banknote,
  BarChart3,
  GitBranch,
  Globe,
  Tag,
  Archive,
  Clock,
  Calendar,
  CheckSquare,
  PieChart,
  FileText,
  Receipt,
  RefreshCw,
  FolderOpen,
  Bell,
  Building2,
  Image,
  FileDown,
  CreditCard,
  List,
  CalendarCheck,
  Target,
  TrendingUp,
  UserRoundPlus,
  Handshake,
  Users,
} from 'lucide-react'

function FeatureChip({ icon: Icon, label, accent = false }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-2 rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-75',
        accent
          ? 'bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-200'
          : 'bg-gray-100 dark:bg-gray-800 border-none text-gray-600 dark:text-gray-400',
      )}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </Badge>
  )
}

export default function WelcomeCarousel({ open, onOpenChange, user }) {
  const [current, setCurrent] = useState(0)

  const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'

  const SLIDES = [
    {
      title: `Welcome to Tercero, ${userName}`,
      subtitle: 'First contact to final invoice — your agency, unified.',
      description:
        'Tercero connects every stage of your agency in one workspace. Prospect a lead, win the deal, deliver the work, and collect payment — without switching tools.',
      emoji: '🚀',
      buttonText: 'Take the tour',
      chips: [],
    },
    {
      title: 'Your prospect pipeline',
      description:
        'Track every lead from first outreach to closed deal. Manage status, notes, and contact details for each prospect — and convert winning ones directly into client workspaces with data pre-filled.',
      emoji: '🎯',
      buttonText: 'Continue',
      chips: [
        { icon: Target,        label: 'Prospect pipeline',    color: 'violet', accent: true },
        { icon: TrendingUp,    label: 'Status tracking',      color: 'sky' },
        { icon: FileText,      label: 'Proposals to prospects', color: 'amber' },
        { icon: UserRoundPlus, label: 'Convert to client',    color: 'emerald', accent: true },
        { icon: Handshake,     label: 'Engagement types',     color: 'teal' },
      ],
    },
    {
      title: 'Manage every client relationship',
      description:
        'Build a full client roster with pipeline health indicators, urgency tracking, custom tiers and industries — plus a clean separation of your own internal account.',
      emoji: '🤝',
      buttonText: 'Continue',
      chips: [
        { icon: BarChart3,  label: 'Pipeline health',    color: 'violet' },
        { icon: Clock,      label: 'Urgency indicators', color: 'amber' },
        { icon: Tag,        label: 'Tiers & industries', color: 'sky' },
        { icon: Building2,  label: 'Internal account',   color: 'teal' },
        { icon: Archive,    label: 'Archive & restore',  color: 'rose' },
      ],
    },
    {
      title: 'Draft, version, and schedule content',
      description:
        'Every post lives through a clear status lifecycle. Track versions, attach media, target specific platforms, and preview exactly how each post looks before it goes out.',
      emoji: '✍️',
      buttonText: 'Continue',
      chips: [
        { icon: GitBranch,     label: 'Post versioning',     color: 'violet' },
        { icon: CalendarCheck, label: 'Status lifecycle',    color: 'sky' },
        { icon: Globe,         label: 'Platform targeting',  color: 'teal' },
        { icon: Image,         label: 'Media uploads',       color: 'amber' },
        { icon: RefreshCw,     label: 'Revision tracking',   color: 'rose' },
      ],
    },
    {
      title: 'Frictionless client approvals',
      description:
        'Share a single link. Clients approve posts or request revisions — no logins, no email chains. Campaign review lets clients action an entire batch at once.',
      emoji: '✅',
      buttonText: 'Continue',
      chips: [
        { icon: MousePointer2, label: 'Magic review link',    color: 'violet', accent: true },
        { icon: CheckSquare,   label: 'One-click approve',    color: 'emerald' },
        { icon: Send,          label: 'Campaign review link', color: 'sky', accent: true },
        { icon: ShieldCheck,   label: 'Per-post tokens',      color: 'amber' },
      ],
    },
    {
      title: 'Campaigns and the content calendar',
      description:
        'Group posts into named campaigns to track KPIs, budget spend, and platform distribution. The calendar gives you a full date-range view of every scheduled post across all clients.',
      emoji: '📣',
      buttonText: 'Continue',
      chips: [
        { icon: Megaphone, label: 'Campaign grouping',      color: 'violet' },
        { icon: BarChart3, label: 'KPI dashboard',          color: 'sky' },
        { icon: Banknote,  label: 'Budget tracker',         color: 'emerald' },
        { icon: PieChart,  label: 'Platform distribution',  color: 'teal' },
        { icon: Calendar,  label: 'Content calendar',       color: 'amber' },
        { icon: FileDown,  label: 'PDF calendar export',    color: 'rose', accent: true },
      ],
    },
    {
      title: 'Proposals, invoicing, and finance',
      description:
        'Send proposals from the same workspace you deliver work in. Generate PDF invoices, track expenses, run a full transaction ledger, and monitor agency profitability — all in one place.',
      emoji: '💰',
      buttonText: 'Continue',
      chips: [
        { icon: FileText,   label: 'Proposals',             color: 'violet', accent: true },
        { icon: Globe,      label: 'Public proposal link',  color: 'sky' },
        { icon: Receipt,    label: 'PDF invoices',          color: 'emerald', accent: true },
        { icon: CreditCard, label: 'Expense tracking',      color: 'amber' },
        { icon: List,       label: 'Transaction ledger',    color: 'teal' },
        { icon: RefreshCw,  label: 'Recurring templates',   color: 'rose' },
      ],
    },
    {
      title: "You're all set",
      description:
        'Invite your team with a single link — they get full workspace access instantly. Meetings, notes, reminders, and secure document storage are there whenever you need them.',
      emoji: '🎉',
      buttonText: 'Get started',
      chips: [
        { icon: Users,      label: 'Team workspace',     color: 'violet' },
        { icon: FolderOpen, label: 'Document storage',   color: 'sky' },
        { icon: Bell,       label: 'Notes & reminders',  color: 'amber' },
        { icon: Calendar,   label: 'Meetings',           color: 'emerald' },
      ],
    },
  ]

  const slide = SLIDES[current]
  const isLast = current === SLIDES.length - 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl! p-0 overflow-hidden border-none bg-background shadow-xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <div className="relative p-10 md:p-14 min-h-[580px] flex flex-col justify-between">

          {/* Progress dots */}
          <div className="flex gap-2 items-center mb-8">
            {SLIDES.map((_, i) => (
              <div
                key={i}
                onClick={() => i < current && setCurrent(i)}
                className={cn(
                  'rounded-full transition-all duration-500',
                  i === current
                    ? 'w-6 h-1.5 bg-foreground'
                    : i < current
                      ? 'w-1.5 h-1.5 bg-foreground/40 cursor-pointer hover:bg-foreground/60'
                      : 'w-1.5 h-1.5 bg-muted-foreground/20',
                )}
              />
            ))}
            <span className="ml-3 text-xs text-muted-foreground/50 tabular-nums select-none">
              {current + 1} / {SLIDES.length}
            </span>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col justify-center">
            <div
              key={current}
              className="space-y-7 animate-in fade-in slide-in-from-bottom-2 duration-700"
            >
              <div className="text-5xl leading-none select-none">
                {slide.emoji}
              </div>

              <div className="space-y-3">
                <h2 className="text-3xl font-medium tracking-tight text-foreground bricolage">
                  {slide.title}
                </h2>
                {slide.subtitle && (
                  <p className="text-lg font-medium text-foreground/60 tracking-tight">
                    {slide.subtitle}
                  </p>
                )}
                <p className="text-base text-muted-foreground leading-relaxed max-w-xl">
                  {slide.description}
                </p>
              </div>

              {slide.chips.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {slide.chips.map((chip) => (
                    <FeatureChip
                      key={chip.label}
                      icon={chip.icon}
                      label={chip.label}
                      color={chip.color}
                      accent={chip.accent ?? false}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-10 border-t border-muted/20">
            <div>
              {current > 0 && (
                <Button
                  variant="ghost"
                  onClick={() => setCurrent((prev) => Math.max(0, prev - 1))}
                >
                  <ChevronLeft className="size-4 mr-1.5" /> Back
                </Button>
              )}
            </div>

            <div className="flex items-center gap-4">
              {!isLast && (
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                >
                  Skip
                </Button>
              )}

              <Button
                onClick={() => {
                  if (isLast) {
                    onOpenChange(false)
                  } else {
                    setCurrent((prev) => prev + 1)
                  }
                }}
              className="px-6"
              >
                {isLast ? (
                  <>Get started <ArrowRight className="size-4 ml-2" /></>
                ) : (
                  <>{slide.buttonText} <ChevronRight className="size-4 ml-2" /></>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
