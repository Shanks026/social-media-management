const LANDSCAPE_LOGO = '/TerceroLand.svg'

export default function MaintenanceScreen({ message }) {
  return (
    <div className="min-h-screen bg-background flex flex-col w-full">
      <div className="flex items-center px-8 py-5 border-b border-border/40">
        <div
          className="h-6 w-24 bg-foreground shrink-0"
          style={{
            maskImage: `url(${LANDSCAPE_LOGO})`,
            maskRepeat: 'no-repeat',
            maskPosition: 'center left',
            maskSize: 'contain',
            WebkitMaskImage: `url(${LANDSCAPE_LOGO})`,
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center left',
            WebkitMaskSize: 'contain',
          }}
        />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center px-8 py-20">
        <div className="max-w-md space-y-6">
          <div className="text-6xl">🔧</div>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight bricolage">
              Down for maintenance
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              {message || "The application is currently undergoing maintenance. We'll be back shortly."}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            This page will automatically update when the application is back online.
          </p>
        </div>
      </div>
    </div>
  )
}
