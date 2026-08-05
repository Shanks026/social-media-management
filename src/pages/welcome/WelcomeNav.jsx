import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Footer navigation: exit on the left, paging on the right. On the last section
 * "Go to dashboard" becomes the primary action and the left-hand exit is dropped,
 * so the same action never appears twice.
 */
export default function WelcomeNav({
  index,
  total,
  onPrev,
  onNext,
  onFinish,
}) {
  const isFirst = index === 0
  const isLast = index === total - 1

  return (
    <div className="flex items-center justify-between gap-3 border-t pt-6">
      <div>
        {!isLast && (
          <Button
            type="button"
            variant="ghost"
            onClick={onFinish}
            className="text-muted-foreground"
          >
            Go to dashboard
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!isFirst && (
          <Button type="button" variant="outline" onClick={onPrev}>
            <ArrowLeft className="mr-1.5 size-4" /> Previous
          </Button>
        )}

        {isLast ? (
          <Button type="button" size="lg" onClick={onFinish} className="gap-2">
            Go to dashboard <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button type="button" onClick={onNext} className="gap-1.5">
            Next <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
