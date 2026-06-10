import { Link } from 'react-router-dom'
import PoliciesTab from './PoliciesTab'

export default function PoliciesPage() {
  return (
    <div className="min-h-screen w-full bg-background">
      <div className="max-w-2xl mx-auto px-6 py-16 space-y-10">
        <div className="flex items-center justify-between">
          <img
            src="/TerceroLand.svg"
            alt="Tercero"
            className="h-5 object-contain dark:invert"
          />
          <Link
            to="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to login
          </Link>
        </div>

        <PoliciesTab />
      </div>
    </div>
  )
}
