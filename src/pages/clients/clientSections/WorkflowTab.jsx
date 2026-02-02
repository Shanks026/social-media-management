import { useState } from 'react'
import { Search, Globe, Clock, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import CreateDraftPost from '../../posts/DraftPostForm'
import DraftPostList from '../../posts/DraftPostList'

export default function WorkflowTab({ client }) {
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-4 w-full md:max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search posts..."
              className="pl-10 h-9 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Select>
            <SelectTrigger className="w-36 h-9 bg-background text-xs">
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5" />
                <SelectValue placeholder="Platform" />
              </div>
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="h-9 px-4"
          >
            <Plus className="h-4 w-4 mr-2" /> Create Post
          </Button>
        </div>
      </div>

      <DraftPostList clientId={client.id} />
      <CreateDraftPost
        clientId={client.id}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  )
}
