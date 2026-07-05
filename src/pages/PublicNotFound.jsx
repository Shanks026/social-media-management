// Fallback for any tampered/malformed public link (review, campaign review,
// proposal, join). Deliberately has zero dependency on auth/subscription
// state — no logout button, no agency-specific branding (that would imply
// this belongs to a particular logged-in account), no navigation tied to the
// authenticated app — since a visitor here may not have a Tercero account at
// all. The plain Tercero wordmark at the bottom is fine to show (it's not
// tenant-specific). Mirrors NotFound.jsx's layout/typography so both 404
// surfaces feel like the same product; only the copy and the missing action
// button differ.
export default function PublicNotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col w-full">
      {/* Hero section */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-20">
        <div className="max-w-lg space-y-6">
          <p className="text-8xl font-semibold tracking-tight text-muted-foreground/30 bricolage">
            404
          </p>

          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight bricolage">
              Invalid link.
              <br />
              <span className="font-normal text-muted-foreground">
                This page isn't available.
              </span>
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              This link is invalid or no longer available. Please contact the agency that shared
              it with you for an updated link.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom mark */}
      <div className="flex justify-center pb-10">
        <div
          className="h-6 w-24 bg-foreground/70"
          style={{
            maskImage: 'url(/TerceroLand.svg)',
            maskRepeat: 'no-repeat',
            maskPosition: 'center',
            maskSize: 'contain',
            WebkitMaskImage: 'url(/TerceroLand.svg)',
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            WebkitMaskSize: 'contain',
          }}
        />
      </div>
    </div>
  )
}
