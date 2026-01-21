import { useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
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

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const editClientSchema = z.object({
  name: z.string().min(2, "Client name is required"),
  description: z.string().optional(),
  email: z.string().email("Invalid email address"),
  mobile_number: z
    .string()
    .regex(/^\+91[6-9]\d{9}$/, "Mobile number must start with +91"),
  status: z.enum(["ACTIVE", "PAUSED"]),
});

export default function EditClient({ client, onClose }) {
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(editClientSchema),
    defaultValues: {
      name: "",
      description: "",
      email: "",
      mobile_number: "+91",
      status: "ACTIVE",
    },
  });

  useEffect(() => {
    if (client) {
      form.reset({
        name: client.name ?? "",
        description: client.description ?? "",
        email: client.email ?? "",
        mobile_number: client.mobile_number ?? "+91",
        status: client.status ?? "ACTIVE",
      });
    }
  }, [client, form]);

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

  function onSubmit(values) {
    mutation.mutate({
      id: client.id,
      ...values,
    });
  }

  return (
    <Dialog open={!!client} onOpenChange={onClose} className="w-[60vw]">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
          <DialogDescription>
            Update details of this client
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-5"
        >
          {/* Client Name */}
          <div className="space-y-2">
            <Label>Client Name *</Label>
            <Input {...form.register("name")} />
            <p className="text-sm text-red-500">
              {form.formState.errors.name?.message}
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              {...form.register("description")}
              placeholder="Description or notes about the client"
            />
          </div>

          {/* Email & Mobile */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input {...form.register("email")} />
              <p className="text-sm text-red-500">
                {form.formState.errors.email?.message}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Mobile *</Label>
              <Input {...form.register("mobile_number")} />
              <p className="text-sm text-red-500">
                {form.formState.errors.mobile_number?.message}
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status *</Label>
            <Select
              value={form.watch("status")}
              onValueChange={(value) =>
                form.setValue("status", value, { shouldDirty: true })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="PAUSED">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                mutation.isPending || !form.formState.isDirty
              }
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
