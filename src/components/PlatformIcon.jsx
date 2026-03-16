/**
 * Platform brand icons as inline SVGs + an overlapping stack component.
 * Platforms: instagram, linkedin, facebook, youtube, google_business
 */

const icons = {
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ig-g1" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="5%" stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" />
          <stop offset="60%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig-g1)" />
      <rect x="6.5" y="6.5" width="11" height="11" rx="3.5" stroke="white" strokeWidth="1.5" fill="none" />
      <circle cx="12" cy="12" r="2.8" stroke="white" strokeWidth="1.5" fill="none" />
      <circle cx="16.2" cy="7.8" r="0.9" fill="white" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="6" fill="#0A66C2" />
      <text x="5" y="17" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="13" fill="white">in</text>
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="6" fill="#1877F2" />
      <path d="M13.5 7.5H15V5H13.5C11.84 5 10.5 6.34 10.5 8V9.5H9V12H10.5V19H13V12H14.5L15 9.5H13V8C13 7.72 13.22 7.5 13.5 7.5Z" fill="white" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="6" fill="#FF0000" />
      <path d="M19.8 8.2C19.6 7.5 19.1 6.9 18.4 6.7C17.1 6.4 12 6.4 12 6.4C12 6.4 6.9 6.4 5.6 6.7C4.9 6.9 4.4 7.5 4.2 8.2C4 9.5 4 12 4 12C4 12 4 14.5 4.2 15.8C4.4 16.5 4.9 17.1 5.6 17.3C6.9 17.6 12 17.6 12 17.6C12 17.6 17.1 17.6 18.4 17.3C19.1 17.1 19.6 16.5 19.8 15.8C20 14.5 20 12 20 12C20 12 20 9.5 19.8 8.2Z" fill="white" />
      <path d="M10.5 14.5V9.5L14.5 12L10.5 14.5Z" fill="#FF0000" />
    </svg>
  ),
  google_business: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="6" fill="white" />
      <rect width="24" height="24" rx="6" fill="#F1F3F4" />
      <path d="M17.5 12.2c0-.4 0-.7-.1-1H12v1.9h3.1c-.1.7-.6 1.4-1.2 1.8v1.5h2c1.2-1.1 1.6-2.7 1.6-4.2z" fill="#4285F4" />
      <path d="M12 18c1.6 0 2.9-.5 3.9-1.4l-2-1.5c-.5.4-1.2.6-1.9.6-1.5 0-2.7-1-3.1-2.3H6.9v1.5C7.9 16.8 9.8 18 12 18z" fill="#34A853" />
      <path d="M8.9 13.4c-.1-.4-.2-.7-.2-1.1s.1-.7.2-1.1v-1.5H6.9C6.3 10.6 6 11.3 6 12s.3 1.4.9 1.9l2-.5z" fill="#FBBC05" />
      <path d="M12 8.6c.8 0 1.6.3 2.1.9l1.6-1.6C14.9 6.8 13.5 6.2 12 6.2c-2.2 0-4.1 1.2-5.1 3.1l2 1.5C9.3 9.6 10.5 8.6 12 8.6z" fill="#EA4335" />
    </svg>
  ),
}

const PLATFORM_COLORS = {
  instagram: 'ring-pink-300',
  linkedin: 'ring-blue-300',
  facebook: 'ring-blue-300',
  youtube: 'ring-red-300',
  google_business: 'ring-gray-200',
}

function normalise(p) {
  return typeof p === 'string' ? p.toLowerCase().replace(/\s+/g, '_') : ''
}

export function PlatformIcon({ platform, size = 22 }) {
  const key = normalise(platform)
  const icon = icons[key]
  if (!icon) {
    // Fallback: grey circle with first letter
    const label = typeof platform === 'string' ? platform[0]?.toUpperCase() : '?'
    return (
      <span
        style={{ width: size, height: size, fontSize: size * 0.45 }}
        className="rounded-md bg-muted flex items-center justify-center text-muted-foreground font-semibold shrink-0"
      >
        {label}
      </span>
    )
  }
  return (
    <span style={{ width: size, height: size }} className="shrink-0 block">
      {icon}
    </span>
  )
}

/**
 * Overlapping platform icon stack — shows up to `max` icons, then a +n bubble.
 */
export function PlatformStack({ platforms = [], max = 3, size = 22 }) {
  if (!platforms.length) return null

  const visible = platforms.slice(0, max)
  const overflow = platforms.length - max

  return (
    <div className="flex items-center">
      {visible.map((p, i) => {
        const key = normalise(p)
        const ringColor = PLATFORM_COLORS[key] ?? 'ring-border'
        return (
          <span
            key={p}
            title={p}
            style={{
              width: size,
              height: size,
              marginLeft: i === 0 ? 0 : -6,
              zIndex: visible.length - i,
            }}
            className={`relative rounded-full ring-2 ring-background shrink-0 block overflow-hidden bg-muted`}
          >
            <PlatformIcon platform={p} size={size} />
          </span>
        )
      })}
      {overflow > 0 && (
        <span
          style={{
            width: size,
            height: size,
            marginLeft: -6,
            fontSize: size * 0.38,
          }}
          className="relative rounded-full ring-2 ring-background bg-muted flex items-center justify-center text-muted-foreground font-semibold shrink-0 z-0"
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}
