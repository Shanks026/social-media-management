import { cn } from '@/lib/utils'

/**
 * Frame for a feature's screenshot. Until real imagery exists it renders a
 * deliberate composition rather than an "image here" box — this is one of the
 * first screens a new user sees.
 *
 * When a screenshot lands, pass `src`: the frame, aspect ratio and rounding stay
 * identical, so swapping imagery in can't shift the layout.
 */
export default function VisualFrame({ src, alt, emoji, caption, className }) {
  return (
    <div
      className={cn(
        // 16:9 frame with object-contain: the app screenshots are wider (~2.19),
        // so they letterbox slightly into the gradient rather than being cropped.
        'relative aspect-video w-full overflow-hidden',
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={alt || caption}
          className="size-full object-contain"
        />
      ) : (
        <>
          {/* Faint grid so the empty surface reads as intentional */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.07] dark:opacity-[0.12]"
            style={{
              backgroundImage:
                'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
          <div className="relative flex size-full flex-col items-center justify-center gap-3 px-8 text-center">
            <span className="text-5xl leading-none select-none">{emoji}</span>
            <p className="max-w-xs text-xs font-medium tracking-wide text-muted-foreground/60">
              {caption}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
