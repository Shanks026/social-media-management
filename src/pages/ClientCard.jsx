import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle, File, Globe, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import StatusBadge from "@/components/StatusBadge";
import { formatDate } from "@/lib/helper";

function ClientCard({ client, onOpen, onEdit, onDelete }) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <Card
        onClick={() => onOpen(client)}
        className="
          cursor-pointer
          p-0
          transition-colors
          bg-card
          shadow-none
          hover:shadow-sm
          border
          hover:bg-card/70
          dark:border-none
          dark:bg-card/50
        "
      >
        <CardContent className="p-5 space-y-4">
          {/* Header: Status + Actions */}
          <div className="flex items-center justify-between">
            <StatusBadge status={client.status} />

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="size-4" />
                </Button>
              </PopoverTrigger>

              <PopoverContent align="end" className="w-36 p-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start px-3 py-2 h-9 hover:bg-accent"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(client);
                  }}
                >
                  <Pencil className="mr-2.5 size-4" />
                  Edit
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start px-3 py-2 h-9 text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 className="mr-2.5 size-4" />
                  Delete
                </Button>
              </PopoverContent>
            </Popover>
          </div>

          {/* Client Name */}
          <div className="space-y-1">
            <h3 className="text-lg font-semibold leading-snug">
              {client.name}
            </h3>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 pt-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-muted/50 rounded-md">
                <File className="size-3.5 text-muted-foreground" />
              </div>
              <div className="text-xs font-medium">{client.posts || 0}</div>
              <div className="text-xs text-muted-foreground">Posts</div>
            </div>

            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-muted/50 rounded-md">
                <Globe className="size-3.5 text-muted-foreground" />
              </div>
              <div className="text-xs font-medium">
                {client.platforms || 0}
              </div>
              <div className="text-xs text-muted-foreground">Platforms</div>
            </div>
          </div>

          {/* Optional description */}
          {client.description && (
            <div className="pt-2">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {client.description}
              </p>
            </div>
          )}

          {/* Date */}
          <div className="pt-4 border-t">
            <div className="text-xs text-muted-foreground">
              Created on {formatDate(client.created_at)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader className="space-y-2">
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" />
              Delete client
            </DialogTitle>

            <DialogDescription className="pt-1">
              Are you sure you want to delete{" "}
              <span className="font-medium">{client.name}</span>?
              This action cannot be undone. All data associated with this
              client will be permanently deleted.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  await onDelete(client);
                } finally {
                  setDeleteOpen(false);
                }
              }}
            >
              Delete
            </Button>

          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ClientCard;