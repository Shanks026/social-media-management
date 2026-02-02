import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge' // Import Badge

const getStatusDotColor = (status) => {
  const config = {
    DRAFT: 'bg-blue-500',
    PENDING_APPROVAL: 'bg-orange-500',
    SCHEDULED: 'bg-violet-500',
    NEEDS_REVISION: 'bg-pink-500',
    ACTIVE: 'bg-green-500',
    PUBLISHED: 'bg-lime-500',
    ARCHIVED: 'bg-slate-500',
  }
  return config[status] ?? 'bg-slate-400'
}

export default function VersionSidebar({
  versions,
  currentPostId,
  currentVersionId,
  clientId,
  onClose,
}) {
  const navigate = useNavigate()

  return (
    <aside className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l bg-muted/20 dark:bg-card/30 p-6 shrink-0 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-foreground">Version History</h2>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="rounded-full hover:bg-muted"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        {versions?.map((v, index) => {
          // Added index here
          const isSelected = v.id === currentVersionId
          const isLatest = index === 0

          return (
            <button
              key={v.id}
              // OPTIONAL: If you want history clicks to stay on the details page
              // but show a specific version, you'll need a version-specific route
              // or a state override. For now, this keeps your standard navigation:
              onClick={() => navigate(`/clients/${clientId}/posts/${v.id}`)}
              className={`group flex items-center border-none justify-between px-4 py-3 cursor-pointer rounded-xl transition-all ${
                isSelected
                  ? 'bg-primary/5'
                  : 'border border-transparent hover:bg-muted'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`size-2.5 rounded-full shrink-0 ${getStatusDotColor(v.status)}`}
                />
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}
                  >
                    v{v.version_number}.0
                  </span>

                  {/* Display "LATEST" for the top version */}
                  {isLatest && (
                    <Badge
                      variant="secondary"
                      className="!text-[10px] !tracking-wide"
                    >
                      Latest
                    </Badge>
                  )}
                </div>
              </div>

              <span className="text-[11px] text-muted-foreground font-medium">
                {format(new Date(v.created_at), 'MMM d, p')}
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
