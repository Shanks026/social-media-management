// DraftPostList.jsx - Updated with card layout
import { useQuery } from "@tanstack/react-query";
import { fetchDraftPostsByClient } from "@/api/posts";
import StatusBadge from "@/components/StatusBadge";
import { CalendarDays, MessageSquare, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function DraftPostList({ clientId }) {
    const { data = [], isLoading } = useQuery({
        queryKey: ["draft-posts", clientId],
        queryFn: () => fetchDraftPostsByClient(clientId),
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-3 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                        <div className="h-40 bg-gray-200 rounded"></div>
                        <div className="space-y-2">
                            <div className="h-3 bg-gray-200 rounded"></div>
                            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No draft posts yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Start creating content by clicking the "Create Post" button above.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((post) => (
                <div
                    key={post.id}
                    className="group border rounded-lg p-4 hover:shadow-md transition-shadow duration-200 bg-card"
                >
                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <StatusBadge status="DRAFT" />
                            <Badge
                                variant="outline"
                                className="text-xs font-normal"
                            >
                                {post.platform}
                            </Badge>
                        </div>

                        {post.scheduled_at && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <CalendarDays className="h-3 w-3" />
                                <span>
                                    {format(new Date(post.scheduled_at), "MMM d")}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Media Preview */}
                    {post.media_urls?.[0] && (
                        <div className="mb-3 rounded-md overflow-hidden border">
                            <img
                                src={post.media_urls[0]}
                                alt="Post media"
                                className="w-full h-40 object-cover hover:scale-105 transition-transform duration-300"
                            />
                        </div>
                    )}

                    {/* Content Preview */}
                    <div className="space-y-3">
                        <p className="text-sm line-clamp-3 leading-relaxed">
                            {post.content}
                        </p>

                        {/* Stats/Info Row */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                            <div className="flex items-center gap-4">
                                {post.media_urls?.length > 1 && (
                                    <span className="flex items-center gap-1">
                                        <span className="font-medium">{post.media_urls.length}</span>
                                        media
                                    </span>
                                )}
                                {post.comments && (
                                    <span className="flex items-center gap-1">
                                        <MessageSquare className="h-3 w-3" />
                                        {post.comments}
                                    </span>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2"
                                    onClick={() => {/* Handle edit */ }}
                                >
                                    Edit
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => {/* Handle preview */ }}
                                >
                                    <ExternalLink className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}