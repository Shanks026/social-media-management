import { Controller } from 'react-hook-form'
import PlatformSelector from '@/pages/clients/PlatformSelector'

export default function PlatformsStep({ form }) {
  const {
    control,
    register,
    setValue,
    watch,
    formState: { errors },
  } = form

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h2 className="text-2xl font-normal bricolage">
          Which platforms does your agency use?
        </h2>
        <p className="text-sm text-muted-foreground">
          These are your own agency accounts — you&apos;ll pick platforms
          separately for each client you add.
        </p>
      </div>

      <div>
        <Controller
          name="platforms"
          control={control}
          render={({ field }) => (
            <PlatformSelector
              selected={field.value || []}
              onChange={field.onChange}
              register={register}
              errors={errors}
              watch={watch}
              setValue={setValue}
            />
          )}
        />
        {errors.platforms && (
          <p className="mt-4 text-xs font-medium text-destructive">
            {errors.platforms.message}
          </p>
        )}
      </div>
    </div>
  )
}
