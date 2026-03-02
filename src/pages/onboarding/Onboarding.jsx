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
        <div className="max-w-4xl w-full space-y-10 animate-in fade-in zoom-in-95 duration-700">
          <div className="space-y-4 text-center">
            <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-2">
              Welcome to Tercero
            </h1>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-muted-foreground">
              Make it yours
            </h2>
            <p className="text-lg text-muted-foreground p-2">
              How would you like to begin your journey with Tercero?
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
            <button
              onClick={() => setMode('full')}
              className="group flex flex-col p-8 rounded-3xl border border-primary/20 bg-primary/2 hover:bg-primary/4 transition-all text-left space-y-6"
            >
              <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="size-6 text-primary" />
              </div>
              <div className="space-y-3 flex-1">
                <h3 className="text-xl font-medium tracking-tight">
                  Full setup
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground/90">
                  Brand your workspace and create a free agency account for your
                  own content. Recommended.
                </p>
              </div>
              <div className="pt-4 flex items-center text-sm font-medium text-primary">
                Get started{' '}
                <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
              </div>
            </button>

            <button
              onClick={() => setMode('branding')}
              className="group flex flex-col p-8 rounded-3xl border border-muted bg-muted/3 hover:bg-muted/8 transition-all text-left space-y-6"
            >
              <div className="size-12 rounded-xl bg-muted flex items-center justify-center">
                <Sparkles className="size-6 text-muted-foreground" />
              </div>
              <div className="space-y-3 flex-1">
                <h3 className="text-xl font-medium tracking-tight">
                  Visual identity
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground/90">
                  Update the logo and name in your sidebar. You can set up your
                  internal account later.
                </p>
              </div>
              <div className="pt-4 flex items-center text-sm font-medium text-muted-foreground">
                Set identity{' '}
                <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
              </div>
            </button>

            <button
              onClick={handleSkip}
              className="group flex flex-col p-8 rounded-3xl border border-muted bg-muted/3 hover:bg-muted/8 transition-all text-left space-y-6"
            >
              <div className="size-12 rounded-xl bg-muted flex items-center justify-center">
                <Rocket className="size-6 text-muted-foreground" />
              </div>
              <div className="space-y-3 flex-1">
                <h3 className="text-xl font-medium tracking-tight">
                  Explore first
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground/90">
                  Head straight to your dashboard. You can customize your
                  branding anytime from the settings.
                </p>
              </div>
              <div className="pt-4 flex items-center text-sm font-medium text-muted-foreground">
                Skip for now{' '}
                <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
              </div>
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
