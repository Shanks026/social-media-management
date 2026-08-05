import VisualFrame from './VisualFrame'

/**
 * One feature section: title and detail on the left, visual on the right.
 * Purely presentational — the shell owns which section is showing.
 */
export default function FeatureSection({ section }) {
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-16">
      {/* Left — title + content */}
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {section.label}
          </p>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight bricolage">
            {section.summary}
          </h2>
        </div>

        <dl className="space-y-5">
          {section.details.map((detail) => (
            <div key={detail.title} className="space-y-1">
              <dt className="text-sm font-semibold text-foreground">
                {detail.title}
              </dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">
                {detail.body}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Right — visual */}
      <VisualFrame
        src={section.image}
        alt={section.label}
        emoji={section.emoji}
        caption={section.visualCaption}
        className="lg:sticky lg:top-8 lg:self-start"
      />
    </div>
  )
}
