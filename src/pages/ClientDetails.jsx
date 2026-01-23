import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchClientById } from '../api/clients'
import { useHeader } from '@/components/misc/header-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Globe, Clock, Plus } from 'lucide-react'

import CreateDraftPost from './posts/DraftPostForm'
import DraftPostList from './posts/DraftPostList'

export default function ClientDetails() {
  const { clientId } = useParams()
  const { setHeader } = useHeader()
  const [createOpen, setCreateOpen] = useState(false)

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
    if (!client) return

    setHeader({
      title: client.name,
      breadcrumbs: [
        { label: 'Clients', href: '/clients' },
        { label: client.name },
      ],
      actions: null,
    })
  }, [client, setHeader])

  if (isLoading)
    return (
      <div className="p-8 text-muted-foreground animate-pulse">
        Loading client profile...
      </div>
    )
  if (error || !client)
    return (
      <div className="p-8 text-destructive font-medium">
        Error loading client details.
      </div>
    )

  return (
    <div className="flex flex-col gap-6 p-8 transition-colors duration-300">
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          {client.name}
        </h1>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-4 w-full md:max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search"
                className="pl-10 bg-background border-input h-9! w-full rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Platform Filter */}
            <Select>
              <SelectTrigger className="w-36 h-9! bg-background">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Platform" />
                </div>
              </SelectTrigger>
              {/* Added position="popper" and sideOffset to fix overlapping */}
              <SelectContent
                position="popper"
                sideOffset={4}
                className="w-[140px]"
              >
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select>
              <SelectTrigger className="w-40 h-9! bg-background">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Status" />
                </div>
              </SelectTrigger>
              {/* Added position="popper" and sideOffset to fix overlapping */}
              <SelectContent
                position="popper"
                sideOffset={4}
                className="w-[130px]"
              >
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Create Post
            </Button>
          </div>
        </div>
      </div>

      <main className="mt-2">
        <DraftPostList clientId={client.id} />
      </main>

      <CreateDraftPost
        clientId={client.id}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  )
}
