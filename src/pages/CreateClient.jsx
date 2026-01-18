import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/api/clients";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function CreateClient({ open, onOpenChange }) {
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [status, setStatus] = useState("ACTIVE");

  const mutation = useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client created successfully");
      setName("");
      setStatus("ACTIVE");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Failed to create client");
    },
  });


  function handleSubmit(e) {
    e.preventDefault();
    mutation.mutate({ name, status });
  }

  function handleCancel() {
    setName("");
    setStatus("ACTIVE");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader className="pb-3">
          <DialogTitle className="text-lg font-semibold">
            Create Client
          </DialogTitle>
          <DialogDescription>
            Add a new client to your workspace
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Client name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter client name"
                required
                autoFocus
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status" className="text-sm font-medium">
                Status
              </Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status" className="h-9 w-full">
                  <SelectValue placeholder="Select status" />
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
              onClick={handleCancel}
              className="h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !name.trim()}
              className="h-9"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Client"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}