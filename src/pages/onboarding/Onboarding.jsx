import { useState } from 'react'
import { completeFullAgencySetup, setupBrandingOnly } from '@/api/agency'
import { ShieldCheck, Sparkles, Rocket, ArrowRight } from 'lucide-react'
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

  // CHOICE VIEW
  if (!mode) {
    return (
      <div className="w-full min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-4xl w-full space-y-8 animate-in fade-in zoom-in-95 duration-500">
          <div className="space-y-1.5 text-center">
            <h1 className="text-3xl font-medium tracking-tight">
              Welcome to Tercero
            </h1>
            <p className="text-sm text-muted-foreground">
              How would you like to set up your workspace?
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => setMode('full')}
              className="group flex flex-col p-5 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/8 transition-all text-left gap-4"
            >
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="size-4 text-primary" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-xl font-medium">Full setup</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Brand your workspace and create a free agency account for your own content. Recommended.
                </p>
              </div>
              <span className="text-xs font-medium text-primary flex items-center gap-1">
                Get started <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>

            <button
              onClick={() => setMode('branding')}
              className="group flex flex-col p-5 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-all text-left gap-4"
            >
              <div className="size-9 rounded-lg bg-muted flex items-center justify-center">
                <Sparkles className="size-4 text-muted-foreground" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-xl font-medium">Visual identity</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Update the logo and name in your sidebar. You can set up your internal account later.
                </p>
              </div>
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                Set identity <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>

            <button
              onClick={handleSkip}
              className="group flex flex-col p-5 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-all text-left gap-4"
            >
              <div className="size-9 rounded-lg bg-muted flex items-center justify-center">
                <Rocket className="size-4 text-muted-foreground" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-xl font-medium">Explore first</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Head straight to your dashboard. You can customize your branding anytime from settings.
                </p>
              </div>
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                Skip for now <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
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
