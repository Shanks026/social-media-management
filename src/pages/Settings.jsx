import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useHeader } from '../components/misc/header-context'
import { User, Building2, FileText, AlertTriangle } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/context/AuthContext'

import ProfileSettings from './settings/ProfileSettings'
import AgencySettings from './settings/AgencySettings'
import InvoiceSettings from './settings/InvoiceSettings'
import DangerZone from './settings/DangerZone'

const VALID_TABS = ['profile', 'agency', 'invoice', 'danger']

export default function Settings() {
  const { setHeader } = useHeader()
  const { user, workspaceUserId } = useAuth()
  const isOwner = !!user?.id && user.id === workspaceUserId
  const [searchParams, setSearchParams] = useSearchParams()

  const tab = VALID_TABS.includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'profile'

  useEffect(() => {
    setHeader({
      title: 'Settings',
      breadcrumbs: [
        { label: 'Settings', href: '/settings' },
        { label: 'General Settings' },
      ],
    })
  }, [setHeader])

  function handleTabChange(value) {
    setSearchParams({ tab: value }, { replace: true })
  }

  return (
    <div className="h-full bg-background overflow-y-auto overflow-x-hidden selection:bg-primary/10 [scrollbar-gutter:stable]">
      <div className="overflow-hidden">
        <div className="px-8 pt-8 pb-20 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-700 fill-mode-both">
          {/* PAGE HEADER */}
          <div className="space-y-1">
            <h1 className="text-3xl font-normal tracking-tight text-foreground bricolage">
              General Settings
            </h1>
            <p className="text-sm text-muted-foreground font-normal">
              Manage your profile and agency workspace.
            </p>
          </div>

          <Tabs
            value={tab}
            onValueChange={handleTabChange}
            className="space-y-6"
          >
            <TabsList className="bg-transparent border-b border-border/40 rounded-none p-0 h-auto gap-8 w-full justify-start">
              {[
                { value: 'profile', icon: User, label: 'Profile' },
                { value: 'agency', icon: Building2, label: 'Agency' },
                { value: 'invoice', icon: FileText, label: 'Invoice' },
                ...(isOwner
                  ? [{ value: 'danger', icon: AlertTriangle, label: 'Danger Zone' }]
                  : []),
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
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
                  <tab.icon className="size-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent
              value="profile"
              className="focus-visible:outline-none"
            >
              <ProfileSettings />
            </TabsContent>

            <TabsContent
              value="agency"
              className="focus-visible:outline-none"
            >
              <AgencySettings />
            </TabsContent>

            <TabsContent
              value="invoice"
              className="focus-visible:outline-none"
            >
              <InvoiceSettings />
            </TabsContent>

            {isOwner && (
              <TabsContent
                value="danger"
                className="focus-visible:outline-none"
              >
                <DangerZone />
              </TabsContent>
            )}

          </Tabs>
        </div>
      </div>
    </div>
  )
}
