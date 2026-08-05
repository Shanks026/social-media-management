import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { WELCOME_SECTIONS } from './sections'
import FeatureSection from './FeatureSection'
import WelcomeNav from './WelcomeNav'
import WelcomeProgress from './WelcomeProgress'

/**
 * Feature overview at /welcome. Opt-in, reached from Help → Guides — finishing
 * setup goes straight to the dashboard rather than through here.
 *
 * The page header is constant across every section; only the section body below
 * it changes. Nothing is pinned to the viewport.
 */
export default function WelcomePage() {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)

  const total = WELCOME_SECTIONS.length
  const goToDashboard = useCallback(() => navigate('/dashboard'), [navigate])

  const next = useCallback(
    () => setIndex((i) => Math.min(total - 1, i + 1)),
    [total],
  )
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  // Arrow keys page through — expected on anything paginated like this.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [next, prev])

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="mx-auto flex min-h-screen max-w-352 flex-col px-6 md:px-10 py-10 md:py-14">
        {/* Persistent header — identical on every section */}
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight bricolage">
              Everything Tercero does
            </h1>
            <p className="text-sm text-muted-foreground">
              Grouped by how the work actually flows, from first contact to final
              invoice.
            </p>
          </div>

          <img
            src="/TerceroIcon.svg"
            alt="Tercero"
            className="mt-1 size-8 shrink-0 object-contain dark:invert"
          />
        </div>

        {/* Position indicator — its own row between the header and the section */}
        <div className="mt-8 border-t pt-6">
          <WelcomeProgress total={total} index={index} onJump={setIndex} />
        </div>

        {/* Section body */}
        <div className="flex-1 py-10 md:py-12">
          <div
            key={WELCOME_SECTIONS[index].key}
            className="animate-in fade-in slide-in-from-bottom-2 duration-500"
          >
            <FeatureSection section={WELCOME_SECTIONS[index]} />
          </div>
        </div>

        {/* Footer navigation */}
        <WelcomeNav
          index={index}
          total={total}
          onPrev={prev}
          onNext={next}
          onFinish={goToDashboard}
        />
      </div>
    </div>
  )
}
