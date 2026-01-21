import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/api/clients";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const createClientSchema = z.object({
  name: z.string().min(2, "Client name is required"),
  description: z.string().optional(),
  email: z.string().email("Invalid email address"),
  mobile_number: z
    .string()
    .regex(/^\+91[6-9]\d{9}$/, "Mobile number must start with +91"),
  status: z.enum(["ACTIVE", "PAUSED"]),
});

export default function CreateClient({ open, onOpenChange }) {
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: "",
      description: "",
      email: "",
      mobile_number: "+91",
      status: "ACTIVE",
    },
  });

  const mutation = useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client created successfully");
      form.reset();
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Failed to create client");
    },
  });

  function onSubmit(values) {
    mutation.mutate(values);
  }

  function handleCancel() {
    form.reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleCancel} className="w-[60vw]">
      <DialogContent >
        <DialogHeader>
          <DialogTitle>Create Client</DialogTitle>
          <DialogDescription>
            Create and onboard a client
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Client Name */}
          <div className="space-y-2">
            <Label>Client Name *</Label>
            <Input {...form.register("name")} placeholder="John Doe" />
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
              <Input
                {...form.register("email")}
                placeholder="example@email.com"
              />
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
                form.setValue("status", value)
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
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
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
