import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateClient } from "@/api/clients";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function EditClient({ client, onClose }) {
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [status, setStatus] = useState("ACTIVE");

  useEffect(() => {
    if (client) {
      setName(client.name || "");
      setStatus(client.status || "ACTIVE");
    }
  }, [client]);

  const mutation = useMutation({
    mutationFn: updateClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client updated");
      onClose();
    },
    onError: () => {
      toast.error("Failed to update client");
    },
  });


  function handleSubmit(e) {
    e.preventDefault();
    mutation.mutate({
      id: client.id,
      name: name.trim(),
      status,
    });
  }

  const hasChanges = name !== client?.name || status !== client?.status;

  return (
    <Dialog open={!!client} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader className="pb-3">
          <DialogTitle className="text-lg font-semibold">
            Edit Client
          </DialogTitle>
          <DialogDescription>Update details of this client</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2.5">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name" className="text-sm font-medium">
                Client name
              </Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter client name"
                required
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-status" className="text-sm font-medium">
                Status
              </Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="edit-status" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PAUSED">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !hasChanges || !name.trim()}
              className="h-9"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}