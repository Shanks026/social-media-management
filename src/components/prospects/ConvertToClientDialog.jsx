import { useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertCircle, ArrowRight, UserRoundPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

// Fields that transfer from a prospect to a client form
// Each entry: { label, prospectKey, clientLabel, required }
const TRANSFER_FIELDS = [
  { label: 'Business name',  prospectKey: 'business_name', required: true },
  { label: 'Email',          prospectKey: 'email' },
  { label: 'Phone',          prospectKey: 'phone' },
  { label: 'Industry',       prospectKey: 'industry' },
  { label: 'Website',        prospectKey: 'website' },
  { label: 'Location',       prospectKey: 'location' },
  { label: 'Contact person', prospectKey: 'contact_name' },
]

// Fields the user always needs to fill in CreateClientPage
const REQUIRED_ON_CLIENT = [
  { label: 'Logo',      note: 'Required — must be uploaded' },
  { label: 'Platforms', note: 'Required — select at least one' },
  { label: 'Tier',      note: 'Defaults to Basic' },
]

export function ConvertToClientDialog({ open, onOpenChange, prospect }) {
  const navigate = useNavigate()

  if (!prospect) return null

  function handleContinue() {
    onOpenChange(false)
    navigate('/clients/create', {
      state: {
        fromProspect: {
          id:           prospect.id,
          name:         prospect.business_name,
          email:        prospect.email        || '',
          mobile_number: prospect.phone       || '',
          industry:     prospect.industry     || '',
          website:      prospect.website      || '',
          location:     prospect.location     || '',
          contact_name: prospect.contact_name || '',
        },
      },
    })
  }

  const transfers = TRANSFER_FIELDS.map((f) => ({
    ...f,
    value: prospect[f.prospectKey] || null,
  }))

  const filled   = transfers.filter((f) => f.value)
  const missing  = transfers.filter((f) => !f.value && !f.required)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <UserRoundPlus className="size-4 text-primary" />
            </div>
            Convert to Client
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Prospect chip */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/40 border border-border/40">
            <div className="size-8 rounded-md bg-background border border-border/50 flex items-center justify-center shrink-0 text-sm font-bold text-muted-foreground">
              {prospect.business_name?.[0]?.toUpperCase() ?? 'P'}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Converting</p>
              <p className="text-sm font-medium truncate">{prospect.business_name}</p>
            </div>
          </div>

          {/* What transfers */}
          {filled.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Transfers across
              </p>
              <div className="space-y-1.5">
                {filled.map((f) => (
                  <div key={f.prospectKey} className="flex items-center gap-2.5 text-sm">
                    <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
                    <span className="text-muted-foreground w-28 shrink-0">{f.label}</span>
                    <span className="text-foreground truncate">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* What needs filling */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              You'll fill in
            </p>
            <div className="space-y-1.5">
              {missing.map((f) => (
                <div key={f.prospectKey} className="flex items-center gap-2.5 text-sm">
                  <AlertCircle className="size-3.5 text-muted-foreground/50 shrink-0" />
                  <span className="text-muted-foreground">{f.label}</span>
                </div>
              ))}
              {REQUIRED_ON_CLIENT.map((f) => (
                <div key={f.label} className="flex items-center gap-2.5 text-sm">
                  <AlertCircle className="size-3.5 text-amber-500 shrink-0" />
                  <span className="text-muted-foreground w-28 shrink-0">{f.label}</span>
                  <span className="text-xs text-muted-foreground/70">{f.note}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            A new client will be created with the above details pre-filled. Prospect data and history stay on this record.
          </p>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleContinue}
            className="gap-2 flex-1 sm:flex-none"
          >
            Continue to Create Client
            <ArrowRight className="size-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
