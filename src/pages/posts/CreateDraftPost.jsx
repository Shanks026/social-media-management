import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createDraftPost } from "@/api/posts";
import { uploadPostImage } from "@/api/storage";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function CreateDraftPost({
    clientId,
    open,
    onOpenChange,
}) {
    const queryClient = useQueryClient();

    const [content, setContent] = useState("");
    const [platform, setPlatform] = useState("instagram");
    const [imageFile, setImageFile] = useState(null);

    const mutation = useMutation({
        mutationFn: createDraftPost,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["draft-posts", clientId],
            });
            resetForm();
            onOpenChange(false);
        },
    });

    function resetForm() {
        setContent("");
        setPlatform("instagram");
        setImageFile(null);
    }

    async function handleSubmit(e) {
        e.preventDefault();

        let mediaUrls = [];

        if (imageFile) {
            const url = await uploadPostImage({
                file: imageFile,
                clientId,
            });
            mediaUrls.push(url);
        }

        mutation.mutate({
            clientId,
            content,
            mediaUrls,
            platform,
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Draft Post</DialogTitle>
                </DialogHeader>

                {/* Version indicator */}
                <div className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary">Version 1</Badge>
                    <Badge variant="outline">Draft</Badge>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <Textarea
                        placeholder="Write your post..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        required
                    />

                    <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    />

                    <Select value={platform} onValueChange={setPlatform}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="linkedin">LinkedIn</SelectItem>
                        </SelectContent>
                    </Select>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={mutation.isLoading}>
                            {mutation.isLoading ? "Saving…" : "Save Draft"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
