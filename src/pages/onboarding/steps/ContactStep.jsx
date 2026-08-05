import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function ContactStep({ form }) {
  const {
    register,
    formState: { errors },
  } = form

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h2 className="text-2xl font-normal bricolage">How do clients reach you?</h2>
        <p className="text-sm text-muted-foreground">
          Your address and website print on every invoice and proposal you send.
        </p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>
              Agency email <span className="text-destructive">*</span>
            </Label>
            <Input {...register('email')} placeholder="hello@youragency.com" />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Phone{' '}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input
              {...register('mobile_number')}
              placeholder="+91 9876543210"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Website{' '}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input {...register('website')} placeholder="https://youragency.com" />
          </div>

          <div className="space-y-2">
            <Label>
              City{' '}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input {...register('location')} placeholder="e.g. Chennai" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>
            Address{' '}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Textarea
            {...register('address')}
            placeholder="e.g. 12, Anna Salai, Nungambakkam, Chennai - 600006"
            className="min-h-20 resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Appears in the header of your invoices.
          </p>
        </div>

        <div className="space-y-2">
          <Label>
            What does your agency do?{' '}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Textarea
            {...register('description')}
            placeholder="A short description of your agency and the work you take on..."
            className="min-h-24 resize-none"
          />
        </div>
      </div>
    </div>
  )
}
