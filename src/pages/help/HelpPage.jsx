import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useHeader } from '@/components/misc/header-context'
import { BookOpen, Headphones, ShieldCheck, Sparkles } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import SupportSettings from '@/pages/settings/SupportSettings'
import PoliciesTab from './PoliciesTab'
import GuidesTab from './GuidesTab'

const UPCOMING_FEATURES = [
  {
    title: 'OAuth & Auto Social Media Publishing',
    description:
      'Connect your Instagram, LinkedIn, X, and YouTube accounts directly to Tercero. Any post that gets approved and scheduled publishes automatically at the set time. The whole workflow from brief to live happens without leaving the platform.',
  },
  {
    title: 'WhatsApp Integration',
    description:
      'Approval requests, review links, and proposal updates will be sent directly to a client\'s WhatsApp instead of email. Clients respond faster on WhatsApp and nothing sits unread for days. You set it up once per client and it runs from there.',
  },
  {
    title: 'Deep Team Management',
    description:
      'Each team member gets their own profile with documents, a salary and payments tracker, and internal notes. Think of it as managing your team the same way you manage clients today, all inside the same workspace.',
  },
  {
    title: 'Client Portal',
    description:
      'Each client gets their own login to a branded workspace under your agency name. They can browse their content calendar, approve posts, download invoices, and follow along on campaigns without needing you to send them anything manually.',
  },
  {
    title: 'Tercero Mobile Application',
    description:
      'A native iOS and Android app focused on the things you actually need on the go: reviewing posts, checking the calendar, tracking approvals, and staying on top of your pipeline without being tied to a desk.',
  },
  {
    title: 'AI Integration',
    description:
      'AI built into the parts of Tercero where it saves real time: drafting captions, rewriting posts for different platforms, flagging campaigns behind on approvals, and surfacing what content types are working best for each client.',
  },
  {
    title: 'Social Media Analytics',
    description:
      'Once publishing is live, performance data comes back in automatically. See reach, impressions, and engagement per post and per client inside Tercero, without logging into each platform separately. Real numbers to back every client conversation.',
  },
]

const VALID_TABS = ['guides', 'contact', 'policies', 'whats-coming']

const TABS = [
  { value: 'guides', icon: BookOpen, label: 'Guides & How it Works' },
  { value: 'contact', icon: Headphones, label: 'Contact & Support' },
  { value: 'policies', icon: ShieldCheck, label: 'Policies' },
  { value: 'whats-coming', icon: Sparkles, label: "What's Coming Next" },
]

export default function HelpPage() {
  const { setHeader } = useHeader()
  const [searchParams, setSearchParams] = useSearchParams()

  const tab = VALID_TABS.includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'guides'

  useEffect(() => {
    setHeader({
      title: 'Help & Info',
      breadcrumbs: [
        { label: 'Settings', href: '/settings' },
        { label: 'Help & Info' },
      ],
    })
  }, [setHeader])

  function handleTabChange(value) {
    setSearchParams({ tab: value }, { replace: true })
  }

  return (
    <div className="h-full bg-background overflow-y-auto overflow-x-hidden selection:bg-primary/10 [scrollbar-gutter:stable]">
      <div className="overflow-x-hidden">
        <div className="px-8 pt-8 pb-20 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-700 fill-mode-both">
          <div className="space-y-1">
            <h1 className="text-3xl font-normal tracking-tight text-foreground bricolage">
              Help & Info
            </h1>
            <p className="text-sm text-muted-foreground font-normal">
              Guides, support, policies, and what's coming next.
            </p>
          </div>

          <Tabs value={tab} onValueChange={handleTabChange} className="space-y-6">
            <TabsList className="bg-transparent border-b border-border/40 rounded-none p-0 h-auto gap-8 w-full justify-start">
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="
                    relative rounded-none bg-transparent px-0 pb-3 pt-0 text-sm font-medium transition-none
                    shadow-none border-b-2 border-transparent text-muted-foreground
                    flex-none w-fit
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
                  <t.icon className="size-4" />
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="guides" className="focus-visible:outline-none">
              <GuidesTab />
            </TabsContent>

            <TabsContent value="contact" className="focus-visible:outline-none">
              <SupportSettings />
            </TabsContent>

            <TabsContent value="policies" className="focus-visible:outline-none">
              <PoliciesTab />
            </TabsContent>

            <TabsContent value="whats-coming" className="focus-visible:outline-none">
              <div className="max-w-2xl space-y-10">
                <div className="space-y-1">
                  <h2 className="text-2xl font-normal tracking-tight bricolage">What's Coming Next</h2>
                  <p className="text-sm text-muted-foreground font-normal">
                    Features we're actively planning. These will roll out progressively across existing plans.
                  </p>
                </div>
                <div className="space-y-8">
                  {UPCOMING_FEATURES.map((feature, i) => (
                    <div key={i} className="flex gap-5">
                      <span className="text-base font-medium text-muted-foreground/60 tabular-nums pt-0.5 shrink-0">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="space-y-1.5">
                        <p className="text-lg font-normal tracking-tight text-foreground bricolage">{feature.title}</p>
                        <p className="text-sm text-muted-foreground font-normal leading-relaxed">{feature.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

