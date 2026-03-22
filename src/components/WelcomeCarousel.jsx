import { useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Send,
  ShieldCheck,
  MousePointer2,
  Rocket,
  ArrowRight,
  Users,
  Layers,
  Link2,
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
} from 'lucide-react'

function FeatureChip({ icon: Icon, label, accent = false }) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium',
        accent
          ? 'border-primary/20 bg-primary/5 text-primary'
          : 'border-border bg-muted/40 text-foreground/70',
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {label}
    </div>
  )
}

export default function WelcomeCarousel({ open, onOpenChange, user }) {
  const [current, setCurrent] = useState(0)

  const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'

  const SLIDES = [
    {
      title: `Welcome to Tercero, ${userName}`,
      description:
        "Your agency's new backbone — clients, content, campaigns, finance, and proposals unified in one distraction-free workspace.",
      icon: <Sparkles className="size-7 text-primary/70" />,
      buttonText: 'Take the tour',
      chips: [],
    },
    {
      title: 'Manage every client relationship',
      description:
        'Build a full client roster with pipeline health indicators, urgency tracking, custom tiers and industries, and separation of internal accounts.',
      icon: <Users className="size-7 text-primary/70" />,
      buttonText: 'Continue',
      chips: [
        { icon: BarChart3,    label: 'Pipeline health' },
        { icon: Clock,        label: 'Urgency indicators' },
        { icon: Tag,          label: 'Tiers & industries' },
        { icon: Building2,    label: 'Internal accounts' },
        { icon: Archive,      label: 'Archived clients' },
      ],
    },
    {
      title: 'Draft and schedule deliverables',
      description:
        'Every post lives through a clear status lifecycle. Track versions, attach media, target specific platforms, and set scheduled dates — all in one view.',
      icon: <Layers className="size-7 text-primary/70" />,
      buttonText: 'Continue',
      chips: [
        { icon: GitBranch,    label: 'Post versioning' },
        { icon: CalendarCheck,label: 'Status lifecycle' },
        { icon: Globe,        label: 'Platform targeting' },
        { icon: Image,        label: 'Media uploads' },
        { icon: RefreshCw,    label: 'Revision tracking' },
      ],
    },
    {
      title: 'The client review loop',
      description:
        'Share a single link. Clients click to approve posts or request revisions — no logins, no email threads. Per-post tokens keep each decision auditable.',
      icon: <Link2 className="size-7 text-primary/70" />,
      buttonText: 'Continue',
      chips: [
        { icon: MousePointer2, label: 'Magic review link',    accent: true },
        { icon: CheckSquare,   label: 'One-click approve' },
        { icon: Send,          label: 'Campaign review link', accent: true },
        { icon: ShieldCheck,   label: 'Per-post tokens' },
      ],
    },
    {
      title: 'Campaigns and the content calendar',
      description:
        'Group posts into named campaigns to track KPIs, budget spend, and platform distribution. The calendar gives you a full date-range view of every scheduled post.',
      icon: <Megaphone className="size-7 text-primary/70" />,
      buttonText: 'Continue',
      chips: [
        { icon: Megaphone,    label: 'Campaign grouping' },
        { icon: BarChart3,    label: 'KPI dashboard' },
        { icon: Banknote,     label: 'Budget tracker' },
        { icon: PieChart,     label: 'Platform distribution' },
        { icon: Calendar,     label: 'Content calendar' },
        { icon: FileDown,     label: 'PDF calendar export', accent: true },
      ],
    },
    {
      title: 'Finance and proposals',
      description:
        'Generate PDF invoices, track expenses and subscriptions, run a transaction ledger, and send proposals that clients sign off on from a public link.',
      icon: <Banknote className="size-7 text-primary/70" />,
      buttonText: 'Continue',
      chips: [
        { icon: Receipt,      label: 'PDF invoices' },
        { icon: CreditCard,   label: 'Expense tracking' },
        { icon: List,         label: 'Transaction ledger' },
        { icon: RefreshCw,    label: 'Recurring templates' },
        { icon: FileText,     label: 'Proposals' },
        { icon: Globe,        label: 'Public proposal link', accent: true },
      ],
    },
    {
      title: "You're all set",
      description:
        'Invite your team via a single link — they get immediate workspace access. Meetings, notes, reminders, and document storage are ready when you need them.',
      icon: <Rocket className="size-7 text-primary/70" />,
      buttonText: 'Get started',
      chips: [
        { icon: Users,        label: 'Team invites' },
        { icon: FolderOpen,   label: 'Document storage' },
        { icon: Bell,         label: 'Notes & reminders' },
        { icon: Calendar,     label: 'Meetings' },
      ],
    },
  ]

  const slide = SLIDES[current]
  const isLast = current === SLIDES.length - 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl! p-0 overflow-hidden border-none bg-background shadow-xl">
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
              <div className="size-14 rounded-xl flex items-center justify-center bg-primary/4 border border-primary/10">
                {slide.icon}
              </div>

              <div className="space-y-3">
                <h2 className="text-3xl font-medium tracking-tight text-foreground">
                  {slide.title}
                </h2>
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
                  className="text-muted-foreground hover:text-foreground hover:bg-transparent font-medium px-0"
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
                  className="h-10 text-muted-foreground hover:text-foreground hover:bg-transparent font-medium"
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
              className="h-10 px-6 font-medium"
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
