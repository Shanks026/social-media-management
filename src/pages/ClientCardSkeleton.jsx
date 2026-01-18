import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ClientCardSkeleton() {
    return (
        <Card
            className="
        p-0
        bg-card
        border
        shadow-none
        dark:border-none
        dark:bg-card/50
      "
        >
            <CardContent className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-20 rounded-md" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                </div>

                {/* Client name */}
                <Skeleton className="h-6 w-3/4" />

                {/* Stats */}
                <div className="flex items-center gap-6 pt-1">
                    <div className="flex items-center gap-2">
                        {/* <Skeleton className="h-7 w-7 rounded-md" />
                        <Skeleton className="h-6 w-6" /> */}
                        <Skeleton className="h-6 w-16" />
                    </div>

                    <div className="flex items-center gap-2">
                        {/* <Skeleton className="h-7 w-7 rounded-md" />
                        <Skeleton className="h-6 w-6" /> */}
                        <Skeleton className="h-6 w-24" />
                    </div>
                </div>

                {/* Description */}
                {/* <div className="space-y-2 pt-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                </div> */}

                {/* Footer date */}
                <div className="pt-4 border-t">
                    <Skeleton className="h-4 w-32" />
                </div>
            </CardContent>
        </Card>
    );
}
