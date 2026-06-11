import { useState } from 'react'
import { completeFullAgencySetup, setupBrandingOnly } from '@/api/agency'
import { Rocket } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import CreateClientPage from '@/pages/clients/CreateClientPage'
import { HeaderProvider } from '@/components/misc/header-context'
import { useQueryClient } from '@tanstack/react-query'

export default function OnboardingPage({ user, onComplete, onSkip }) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState(null) // null (choice), 'full', 'branding'

  const handleSkip = () => {
    if (onSkip) {
      onSkip()
    } else {
      window.location.href = '/'
    }
  }

  // Derive the user's display name
  const firstName = (() => {
    const fullName = user?.user_metadata?.full_name
    if (fullName) return fullName.split(' ')[0]
    const emailUser = user?.email?.split('@')[0]
    if (emailUser) return emailUser.charAt(0).toUpperCase() + emailUser.slice(1)
    return null
  })()

  // CHOICE VIEW
  if (!mode) {
    return (
      <div className="w-full min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-4xl w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="space-y-3 text-center">
            {firstName && (
              <p className="text-sm font-medium text-muted-foreground tracking-wide animate-in fade-in slide-in-from-bottom-2 duration-700">
                Hey,{' '}
                <span className="text-foreground font-semibold">{firstName}</span>
                {' '}👋
              </p>
            )}
            <h1 className="text-4xl font-semibold tracking-tight bricolage">
              The command center for your agency.
            </h1>
            <p className="text-sm text-muted-foreground">
              Let's get your workspace ready. Pick how you'd like to begin.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setMode('full')}
              className="cursor-pointer group flex flex-col p-6 rounded-xl border hover:border-violet-300 dark:hover:border-violet-800 hover:shadow-sm hover:-translate-y-0.5 transition-all text-left gap-5"
            >
              <span className="text-3xl">🚀</span>
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-semibold bricolage">Full setup</h3>
                  <Badge variant="secondary" className="bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-400 font-medium">Recommended</Badge>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Set up your brand identity and create an internal agency account — everything ready in one go.
                </p>
              </div>
            </button>

            <button
              onClick={() => setMode('branding')}
              className="cursor-pointer group flex flex-col p-6 rounded-xl border hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-sm hover:-translate-y-0.5 transition-all text-left gap-5"
            >
              <span className="text-3xl">🎨</span>
              <div className="space-y-2 flex-1">
                <h3 className="text-xl font-semibold bricolage">Visual identity</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Add your logo and agency name to the sidebar. You can create your internal account whenever you're ready.
                </p>
              </div>
            </button>

            {/* <button
              onClick={handleSkip}
              className="group flex flex-col p-5 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-all text-left gap-4"
            >
              <div className="size-9 rounded-lg bg-muted flex items-center justify-center">
                <Rocket className="size-4 text-muted-foreground" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-xl font-medium bricolage">Explore first</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Head straight to your dashboard. You can customize your branding anytime from settings.
                </p>
              </div>
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                Skip for now <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button> */}
          </div>
        </div>
      </div>
    )
  }

  // FORM VIEW
  return (
    <HeaderProvider>
      <div className="w-full relative bg-background animate-in fade-in slide-in-from-bottom-4 duration-500">
        <CreateClientPage
          standalone
          customSubmit={async (data) => {
            if (mode === 'branding') {
              return await setupBrandingOnly(data)
            } else {
              return await completeFullAgencySetup(data)
            }
          }}
          onSuccess={async () => {
            if (mode !== 'branding') {
              await queryClient.invalidateQueries({
                queryKey: ['internal-client'],
              })
              queryClient.invalidateQueries({ queryKey: ['clients'] })
              queryClient.invalidateQueries({ queryKey: ['subscription'] })
            }
            if (onComplete) onComplete()
            else window.location.href = '/'
          }}
          onCancel={() => setMode(null)}
          defaultValues={{
            name: '',
            description: '',
            email: user?.email || '',
            mobile_number: '+91',
            website: '',
            location: '',
            address: '',
            status: 'ACTIVE',
            tier: 'INTERNAL',
            logo_url: '',
            platforms: [],
            industry: 'Internal',
            social_links: {},
          }}
        />
      </div>
    </HeaderProvider>
  )
}
