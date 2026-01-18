import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ImageIcon, X, Instagram, Linkedin, Send, Loader2 } from "lucide-react";

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
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";

const formSchema = z.object({
    content: z.string().min(1, "Post content is required"),
    platform: z.enum(["instagram", "linkedin"]),
    image: z.any().optional(),
});

export default function CreateDraftPost({ clientId, open, onOpenChange }) {
    const queryClient = useQueryClient();
    const [previewUrl, setPreviewUrl] = useState(null);
    const fileInputRef = useRef(null);

    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            content: "",
            platform: "instagram",
        },
    });

    const mutation = useMutation({
        mutationFn: async (values) => {
            let mediaUrls = [];
            const imageFile = values.image?.[0];

            if (imageFile) {
                const url = await uploadPostImage({
                    file: imageFile,
                    clientId,
                });
                mediaUrls.push(url);
            }

            return createDraftPost({
                clientId,
                content: values.content,
                mediaUrls,
                platform: values.platform,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["draft-posts", clientId],
            });
            resetForm();
            onOpenChange(false);
        },
    });

    function resetForm() {
        form.reset();
        setPreviewUrl(null);
    }

    async function onSubmit(values) {
        mutation.mutate(values);
    }

    const handleImageChange = (e, field) => {
        const file = e.target.files?.[0];
        if (file) {
            field.onChange(e.target.files);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }
    };

    const removeImage = () => {
        form.setValue("image", undefined);
        setPreviewUrl(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden gap-0">
                <DialogHeader className="p-6 pb-2">
                    <div className="flex items-center justify-between mt-4">
                        <DialogTitle className="text-xl font-semibold">Create Post</DialogTitle>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="">
                                Version 1
                            </Badge>
                            <Badge variant="outline" className="">
                                Draft
                            </Badge>
                        </div>
                    </div>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0 text-sm">
                        <div className="p-6 pt-2 space-y-4">
                            <FormField
                                control={form.control}
                                name="content"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Textarea
                                                placeholder="What's on your mind?"
                                                className="min-h-[120px] resize-none"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {previewUrl && (
                                <div className="relative rounded-lg overflow-hidden border bg-muted/50 group">
                                    <img
                                        src={previewUrl}
                                        alt="Preview"
                                        className="w-full h-auto max-h-[300px] object-contain mx-auto"
                                    />
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={removeImage}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-2 mt-4">
                                <div className="flex items-center gap-2">
                                    <FormField
                                        control={form.control}
                                        name="image"
                                        render={({ field: { value, onChange, onBlur, name } }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <div className="flex items-center">
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            name={name}
                                                            onBlur={onBlur}
                                                            ref={fileInputRef}
                                                            onChange={(e) => handleImageChange(e, { onChange })}
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-muted-foreground hover:text-primary transition-colors"
                                                            onClick={() => fileInputRef.current?.click()}
                                                        >
                                                            <ImageIcon className="h-5 w-5 mr-2" />
                                                            Add Media
                                                        </Button>
                                                    </div>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="platform"
                                    render={({ field }) => (
                                        <FormItem className="space-y-0">
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <FormControl>
                                                    <SelectTrigger className="w-[140px] h-9 border-none bg-muted/50 focus:ring-0">
                                                        <SelectValue placeholder="Platform" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="instagram">
                                                        <div className="flex items-center">
                                                            <Instagram className="h-4 w-4 mr-2 text-pink-500" />
                                                            <span>Instagram</span>
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="linkedin">
                                                        <div className="flex items-center">
                                                            <Linkedin className="h-4 w-4 mr-2 text-blue-600" />
                                                            <span>LinkedIn</span>
                                                        </div>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        <DialogFooter className="p-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={mutation.isLoading}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={mutation.isLoading}
                                className="gap-2"
                            >
                                {mutation.isLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4" />
                                        Save Draft
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
