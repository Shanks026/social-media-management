import { LoginForm } from './login-form'
import { Link } from 'react-router-dom'

export default function LoginPage() {
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

          {/* Welcome heading */}
          <div className="space-y-2">
            <h1 className="text-3xl font-normal tracking-tight">
              Welcome to Tercero
            </h1>
            <p className="text-sm text-muted-foreground font-normal">
              Don&apos;t have an account?{' '}
              <Link
                to="/signup"
                className="text-foreground font-medium hover:underline underline-offset-4"
              >
                Sign up
              </Link>
            </p>
          </div>

          {/* Form */}
          <LoginForm />

          {/* Policy */}
          <p className="text-xs text-muted-foreground font-normal leading-relaxed">
            By logging in, you agree to our{' '}
            <a
              href="#"
              className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href="#"
              className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
