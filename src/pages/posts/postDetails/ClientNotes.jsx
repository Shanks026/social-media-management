import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MessageSquareOff } from 'lucide-react'

const CommentItem = ({ name, content, date }) => {
  const initials = name ? name.charAt(0).toUpperCase() : 'C'

  return (
    <div className="flex gap-4 py-6 ">
      <Avatar className="h-9 w-9 border">
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">{name}</h4>
          {/* <span className="text-[11px] text-muted-foreground">Client Note</span> */}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {content}
        </p>
      </div>
    </div>
  )
}

export default function ClientNotes({ notes, clientName }) {
  return (
    <div className="mt-12 space-y-4 border-t pt-8">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-lg font-semibold tracking-tight">
          Client Feedback
        </h3>
      </div>

      {notes ? (
        <div className="max-w-3xl">
          <CommentItem name={clientName} content={notes} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 px-4 rounded-xl border border-dashed text-muted-foreground bg-muted/10">
          <MessageSquareOff size={24} className="mb-2 opacity-20" />
          <p className="text-sm italic">
            No notes provided by the client for this version.
          </p>
        </div>
      )}
    </div>
  )
}
