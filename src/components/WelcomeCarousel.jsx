import { useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Send,
  ShieldCheck,
  MousePointer2,
  Rocket,
  ArrowRight,
} from 'lucide-react'

export default function WelcomeCarousel({
  open,
  onOpenChange,
  user,
}) {
  const [current, setCurrent] = useState(0)

  const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'

  const SLIDES = [
    {
      title: `Welcome to Tercero, ${userName}`,
      description:
        "Tercero is designed to be the backbone of your agency. Let's take a quick tour of your new workspace.",
      icon: <Sparkles className="size-7 text-primary/70" />,
      buttonText: 'See how it works',
    },
    {
      title: 'The Magic Link workflow',
      description:
        'Forget email threads. Send a single link where clients can review, request revisions, and approve posts in seconds.',
      icon: <MousePointer2 className="size-7 text-primary/70" />,
      buttonText: 'Continue',
    },
    {
      title: 'Built to scale',
      description:
        'Manage post versioning and automated scheduling through a skeletal, distraction-free interface.',
      icon: <Send className="size-7 text-primary/70" />,
      buttonText: 'Get started',
    },
  ]

  const handleBack = () => {
    setCurrent((prev) => Math.max(0, prev - 1))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl! p-0 overflow-hidden border-none bg-background shadow-xl">
        <div className="relative p-10 md:p-14 min-h-[520px] flex flex-col justify-between">
          {/* Progress Indicator */}
          <div className="flex gap-3 justify-start mb-8">
            {SLIDES.map((_, i) => (
              <div
                key={i}
                className={`h-0.5 transition-all duration-500 ${
                  i === current ? 'w-10 bg-primary' : 'w-4 bg-muted'
                }`}
              />
            ))}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col justify-center">
            <div
              key={current}
              className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700"
            >
              <div className="size-14 rounded-xl flex items-center justify-center bg-primary/4 border border-primary/10">
                {SLIDES[current].icon}
              </div>

              <div className="space-y-4">
                <h2 className="text-3xl font-medium tracking-tight text-foreground">
                  {SLIDES[current].title}
                </h2>
                <p className="text-base text-muted-foreground leading-relaxed max-w-lg">
                  {SLIDES[current].description}
                </p>
              </div>
            </div>
          </div>

          {/* Footer Navigation */}
          <div className="flex items-center justify-between pt-10 border-t border-muted/20">
            <div className="flex items-center">
              {current > 0 && (
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  className="text-muted-foreground hover:text-foreground hover:bg-transparent font-medium px-0 mr-8"
                >
                  <ChevronLeft className="size-4 mr-2" /> Back
                </Button>
              )}
            </div>

            <Button
              onClick={() => {
                const isLast = current === SLIDES.length - 1
                if (isLast) {
                  onOpenChange(false)
                } else {
                  setCurrent((prev) => prev + 1)
                }
              }}
              className="h-10 px-6 bg-foreground text-background hover:bg-foreground/90 font-medium rounded-lg transition-all"
            >
              {SLIDES[current].buttonText}{' '}
              <ChevronRight className="size-4 ml-2" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
