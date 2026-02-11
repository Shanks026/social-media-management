import { GalleryVerticalEnd } from 'lucide-react'
import { LoginForm } from './login-form'
import { Link } from 'react-router-dom'

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2 w-full bg-background font-sans antialiased">
      {/* Brand/Image Section */}
      <div className="bg-muted relative hidden lg:block border-r border-border/40">
        <img
          src="/placeholder.svg"
          alt="Dashboard Preview"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
        {/* Subtle Overlay Logo */}
        <div className="absolute top-10 left-10 flex items-center gap-2 text-white z-10">
          <div className="bg-white/10 backdrop-blur-md p-2 rounded-lg">
            <GalleryVerticalEnd className="size-6 text-white" />
          </div>
          <span className="text-xl font-medium tracking-tight">Tertiary</span>
        </div>
      </div>

      {/* Login Section */}
      <div className="flex flex-col p-6 md:p-10 lg:p-16">
        <div className="flex justify-center md:justify-start mb-12 lg:hidden">
          <a href="#" className="flex items-center gap-2.5 font-medium text-lg">
            <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl">
              <GalleryVerticalEnd className="size-5" />
            </div>
            <span>Tertiary</span>
          </a>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[380px] space-y-8">
            <LoginForm />

            <div className="text-center text-sm text-muted-foreground pt-4">
              Don&apos;t have an account?{' '}
              <Link
                to="/signup"
                className="text-primary font-medium hover:underline underline-offset-4"
              >
                Create account
              </Link>
            </div>
          </div>
        </div>

        {/* Google-style Footer links */}
        <div className="mt-auto flex gap-6 text-xs text-muted-foreground justify-center">
          <a href="#" className="hover:underline">
            Privacy
          </a>
          <a href="#" className="hover:underline">
            Terms
          </a>
          <a href="#" className="hover:underline">
            Help
          </a>
        </div>
      </div>
    </div>
  )
}
