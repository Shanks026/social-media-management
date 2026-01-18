import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDraftPostsByClient } from "@/api/posts";
import StatusBadge from "@/components/StatusBadge";
import { CalendarDays, MessageSquare, ExternalLink, MoreVertical, Edit2, Eye, Share2, Clipboard, X, Trash2, Folder, ArrowUpRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty"

export default function DraftPostList({ clientId }) {
    const [previewPost, setPreviewPost] = useState(null);
    const { data = [], isLoading } = useQuery({
        queryKey: ["draft-posts", clientId],
        queryFn: () => fetchDraftPostsByClient(clientId),
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Card key={i} className="overflow-hidden border-none shadow-sm bg-card/50">
                        <CardHeader className="p-4 flex-row items-center justify-between space-y-0">
                            <Skeleton className="h-5 w-20" />
                            <Skeleton className="h-4 w-16" />
                        </CardHeader>
                        <div className="px-4">
                            <Skeleton className="h-32 w-full rounded-md" />
                        </div>
                        <CardContent className="p-4 space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-5/6" />
                        </CardContent>
                        <CardFooter className="p-4 pt-0 border-t bg-muted/20 flex justify-between items-center">
                            <Skeleton className="h-4 w-24" />
                            <div className="flex gap-2">
                                <Skeleton className="h-8 w-8 rounded-md" />
                                <Skeleton className="h-8 w-8 rounded-md" />
                            </div>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        );
    }

    if (data.length === 0) {
        return (

            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Folder />
                    </EmptyMedia>
                    <EmptyTitle>No draft posts yet</EmptyTitle>
                    <EmptyDescription>
                        Start creating content by clicking the "Create Post" button. Your drafts will appear here.
                    </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <div className="flex gap-2">
                        <Button>Create Post</Button>

                    </div>
                </EmptyContent>
                <Button
                    variant="link"
                    asChild
                    className="text-muted-foreground"
                    size="sm"
                >
                    <a href="#">
                        Learn More <ArrowUpRightIcon />
                    </a>
                </Button>
            </Empty>
        );
    }

    return (
        <TooltipProvider>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.map((post) => (
                    <Card
                        key={post.id}
                        className="group flex flex-col overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-300 bg-card/50 hover:bg-card/70"
                    >
                        {/* Card Header */}
                        <CardHeader className="p-4 flex-row items-center justify-between space-y-0">
                            <div className="flex items-center gap-2">
                                <StatusBadge status="DRAFT" />
                                <Badge
                                    variant="secondary"
                                    className="rounded-md capitalize px-2"
                                >
                                    {post.platform}
                                </Badge>
                            </div>

                            {post.scheduled_at && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                    <CalendarDays className="h-3.5 w-3.5" />
                                    <span>
                                        {format(new Date(post.scheduled_at), "MMM d, h:mm a")}
                                    </span>
                                </div>
                            )}
                        </CardHeader>

                        {/* Media Preview - COMPACT with HOVER OVERLAY */}
                        <div className="px-4">
                            {post.media_urls?.[0] ? (
                                <div
                                    className="relative h-48 rounded-xl overflow-hidden border bg-muted group/media cursor-pointer"
                                    onClick={() => setPreviewPost(post)}
                                >
                                    <img
                                        src={post.media_urls[0]}
                                        alt="Post media"
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover/media:scale-110"
                                    />

                                    {/* Hover Overlay - No Blur, Top-Right Button */}
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/media:opacity-100 transition-opacity duration-300 p-3 flex justify-end items-start">
                                        <div className="bg-black/60 p-2 rounded-lg border border-white/10 shadow-lg transform translate-y-2 group-hover/media:translate-y-0 transition-all duration-300">
                                            <Eye className="h-5 w-5 text-white" />
                                        </div>
                                    </div>

                                    {post.media_urls.length > 1 && (
                                        <Badge
                                            variant="secondary"
                                            className="absolute bottom-2 right-2 bg-black/60 text-white border-none backdrop-blur-sm px-1.5 py-0 text-[10px]"
                                        >
                                            +{post.media_urls.length - 1} more
                                        </Badge>
                                    )}
                                </div>
                            ) : (
                                <div className="h-48 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground gap-1 bg-muted/30">
                                    <MessageSquare className="h-5 w-5 opacity-30" />
                                    <span className="text-[9px] font-medium uppercase tracking-tight">No Media</span>
                                </div>
                            )}
                        </div>

                        {/* Content Preview - NORMAL TEXT */}
                        <CardContent className="p-4 flex-grow">
                            <p className="text-sm text-foreground/90 line-clamp-3 leading-relaxed">
                                {post.content || "No content provided..."}
                            </p>
                        </CardContent>

                        {/* Card Footer */}
                        <CardFooter className="p-4 pt-0 mt-auto flex items-center justify-between border-t bg-muted/5">
                            <div className="flex items-center gap-3">
                                {post.comments !== undefined && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <MessageSquare className="h-3.5 w-3.5" />
                                        <span className="font-semibold">{post.comments}</span>
                                    </div>
                                )}
                                <span className="text-xs text-muted-foreground font-medium">
                                    {format(new Date(post.created_at), "MMM d")}
                                </span>
                            </div>

                            <div className="flex items-center">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-full hover:bg-primary/10 transition-colors"
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 p-1.5">
                                        <DropdownMenuItem className="gap-2.5 cursor-pointer rounded-md">
                                            <Edit2 className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-medium text-sm">Edit Post</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="gap-2.5 cursor-pointer rounded-md">
                                            <Share2 className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-medium text-sm">Duplicate</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="gap-2.5 cursor-pointer rounded-md">
                                            <Clipboard className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-medium text-sm">Copy Link</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive focus:text-destructive gap-2.5 cursor-pointer rounded-md">
                                            <Trash2 className="h-4 w-4" />
                                            <span className="font-medium text-sm">Delete Draft</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            {/* Preview Dialog - IMAGE ONLY, 90% SCREEN */}
            <Dialog open={!!previewPost} onOpenChange={() => setPreviewPost(null)}>
                <DialogContent className="h-[75vh] !max-w-[75vw] p-0 border-none shadow-2xl bg-black/95 overflow-hidden flex items-center justify-center">
                    {previewPost?.media_urls?.[0] && (
                        <div className="relative w-full h-full flex items-center justify-center p-4">
                            <img
                                src={previewPost.media_urls[0]}
                                alt="Preview"
                                className="max-w-full max-h-full object-contain rounded-sm shadow-2xl"
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    );
}

