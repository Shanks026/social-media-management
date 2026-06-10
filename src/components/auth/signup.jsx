import { SignupForm } from './signup-form'
import { Link } from 'react-router-dom'

export default function SignupPage() {
  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      {/* Main content */}
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm space-y-8 text-center">
          {/* Icon mark */}
          <div className="flex justify-center">
            <img
              src="/TerceroIcon.svg"
              alt="Tercero"
              className="size-9 object-contain dark:invert"
            />
          </div>

          {/* Heading */}
          <div className="space-y-1.5">
            <h1 className="text-3xl font-normal tracking-tight bricolage">
              Orchestrate your agency.
            </h1>
            <p className="text-sm text-muted-foreground font-normal">
              Create your account.{' '}Already have one?{' '}
              <Link
                to="/login"
                className="text-foreground font-medium underline decoration-dotted underline-offset-4 hover:text-muted-foreground transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>

          {/* Form */}
          <SignupForm />

          {/* Policy */}
          <p className="text-xs text-muted-foreground font-normal leading-relaxed">
            By signing up, you agree to our{' '}
            <Link
              to="/policies"
              target="_blank"
              className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
            >
              policies
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
