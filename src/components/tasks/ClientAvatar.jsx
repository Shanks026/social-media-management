import { Building2 } from 'lucide-react'

export function ClientAvatar({ client, size = 'sm' }) {
  const dim = size === 'sm' ? 'size-5' : 'size-7'
  if (client?.logo_url) {
    return (
      <img
        src={client.logo_url}
        alt=""
        className={`${dim} rounded-full object-cover ring-1 ring-border shrink-0`}
      />
    )
  }
  return (
    <div
      className={`${dim} rounded-full bg-muted flex items-center justify-center shrink-0`}
    >
      <Building2 className="size-3 text-muted-foreground" />
    </div>
  )
}

export default ClientAvatar
