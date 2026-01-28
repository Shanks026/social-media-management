export const ComingSoon = ({ icon: Icon, title }) => (
  <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed rounded-2xl bg-muted/5 mt-6">
    <div className="size-12 rounded-full bg-background flex items-center justify-center border shadow-sm mb-4">
      <Icon className="size-6 text-muted-foreground" />
    </div>
    <h3 className="text-sm font-semibold">{title}</h3>
    <p className="text-xs text-muted-foreground mt-1">
      This feature is currently in development.
    </p>
  </div>
)
