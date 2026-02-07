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
} from 'lucide-react'

const SLIDES = [
  {
    title: 'Welcome to your new Agency Hub',
    description:
      "Manage clients and social content without the chaos. Let's show you how to streamline your workflow.",
    icon: <Sparkles className="size-10 text-primary" />,
    color: 'bg-primary/[0.03]',
  },
  {
    title: 'The Magic Link Workflow',
    description:
      'Send a single link to your clients where they can review, request revisions, or approve posts in seconds.',
    icon: <MousePointer2 className="size-10 text-primary" />,
    color: 'bg-primary/[0.03]',
  },
  {
    title: 'Scale with Confidence',
    description:
      'A fast, skeletal interface designed to handle onboarding and scheduling as your agency grows.',
    icon: <Send className="size-10 text-primary" />,
    color: 'bg-primary/[0.03]',
  },
]

export default function WelcomeCarousel({ open, onOpenChange, onStartSetup }) {
  const [current, setCurrent] = useState(0)
  const isLast = current === SLIDES.length - 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-2xl p-0 overflow-hidden border-none bg-background shadow-2xl">
        <div className="relative p-12 md:p-16 space-y-12">
          {/* Progress Indicator */}
          <div className="flex gap-2 justify-start">
            {SLIDES.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-500 ${
                  i === current ? 'w-12 bg-primary' : 'w-4 bg-muted'
                }`}
              />
            ))}
          </div>

          {/* Content Area */}
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div
              className={`size-20 rounded-3xl flex items-center justify-center ${SLIDES[current].color} border border-primary/5`}
            >
              {SLIDES[current].icon}
            </div>

            <div className="space-y-4">
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-[0.9]">
                {SLIDES[current].title}
              </h2>
              <p className="text-lg text-muted-foreground font-medium leading-relaxed max-w-md">
                {SLIDES[current].description}
              </p>
            </div>
          </div>

          {/* Navigation Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-8 border-t border-muted/30">
            <div className="flex items-center gap-2">
              {current > 0 && (
                <Button
                  variant="ghost"
                  onClick={() => setCurrent((prev) => prev - 1)}
                  
                >
                  <ChevronLeft className="size-4 mr-1" /> Back
                </Button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              {isLast ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                   
                  >
                    Start Managing Clients
                  </Button>
                  <Button
                    onClick={onStartSetup}
                  
                  >
                    Brand your Agency <ShieldCheck className="ml-2 size-4" />
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setCurrent((prev) => prev + 1)}
        
                >
                  Next <ChevronRight className="size-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
