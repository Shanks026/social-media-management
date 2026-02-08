import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchClientById } from '../../api/clients'
import { useHeader } from '@/components/misc/header-context'
import ClientProfileView from './ClientProfileView'

export default function ClientDetails() {
  const { clientId } = useParams()
  const { setHeader } = useHeader()

  const {
    data: client,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => fetchClientById(clientId),
    enabled: !!clientId,
  })

  useEffect(() => {
    if (client) {
      setHeader({
        title: client.name,
        breadcrumbs: [
          { label: 'Clients', href: '/clients' },
          { label: client.name },
        ],
      })
    }
  }, [client, setHeader])

  if (isLoading)
    return (
      <div className="p-8 animate-pulse text-muted-foreground">
        Loading profile...
      </div>
    )
  if (error || !client)
    return <div className="p-8 text-destructive">Error loading client.</div>

  return <ClientProfileView client={client} />
}
