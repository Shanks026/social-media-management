import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { GUIDES } from './guides-data'

export default function GuidesTab() {
  const [activeId, setActiveId] = useState(GUIDES[0]?.id)
  const contentRef = useRef(null)
  useEffect(() => {
    const container = contentRef.current
    if (!container) return

    function handleScroll() {
      const sections = container.querySelectorAll('[data-guide-section]')
      const scrollTop = container.scrollTop
      let current = GUIDES[0]?.id

      for (const section of sections) {
        if (section.offsetTop <= scrollTop + 60) {
          current = section.id
        }
      }

      setActiveId(current)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  function scrollTo(id) {
    const container = contentRef.current
    const target = document.getElementById(id)
    if (!container || !target) return
    container.scrollTo({ top: target.offsetTop, behavior: 'smooth' })
  }

  return (
    <div className="flex gap-16">
      {/* Content — own scroll container so right nav stays fixed */}
      <div className="flex-1 min-w-0 max-w-3xl flex flex-col gap-8">
        <div className="space-y-1">
          <h2 className="text-2xl font-normal tracking-tight bricolage">Guides & How it Works</h2>
          <p className="text-sm text-muted-foreground font-normal">
            A walkthrough of every section in Tercero and how to get the most out of it.
          </p>
        </div>

        <div ref={contentRef} className="relative overflow-y-auto max-h-[calc(100vh-300px)] pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="space-y-16">
        {GUIDES.map((guide) => (
          <section key={guide.id} id={guide.id} data-guide-section className="space-y-8 scroll-mt-8">
            <div className="space-y-1">
              <h3 className="text-xl font-normal tracking-tight bricolage">{guide.title}</h3>
              <p className="text-sm text-muted-foreground font-normal">{guide.description}</p>
            </div>
            <div className="space-y-6">
              {guide.sections.map((section, i) => (
                <div key={i} className="space-y-1.5">
                  <p className="text-sm font-medium text-foreground">{section.heading}</p>
                  <p className="text-sm text-muted-foreground font-normal leading-relaxed">{section.body}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
        </div>
        </div>
      </div>

      {/* Right nav — stays in place while left scrolls */}
      <div className="hidden lg:block w-48 shrink-0">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/50 mb-3">
            On this page
          </p>
          {GUIDES.map((guide) => (
            <button
              key={guide.id}
              onClick={() => scrollTo(guide.id)}
              className={cn(
                'block w-full text-left text-sm py-1 transition-colors',
                activeId === guide.id
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {guide.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
