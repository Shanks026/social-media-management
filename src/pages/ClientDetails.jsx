import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchClientById } from "../api/clients";
import StatusBadge from "@/components/StatusBadge";
import { useHeader } from "@/components/misc/header-context";
import { Button } from "@/components/ui/button";
import DraftPostList from "./posts/DraftPostList";
import CreateDraftPost from "./posts/CreateDraftPost";

export default function ClientDetails() {
    const { clientId } = useParams();
    const { setHeader } = useHeader();
    const [createOpen, setCreateOpen] = useState(false);

    const {
        data: client,
        isLoading,
        error,
    } = useQuery({
        queryKey: ["client", clientId],
        queryFn: () => fetchClientById(clientId),
        enabled: !!clientId,
    });

    useEffect(() => {
        if (!client) return;

        setHeader({
            title: client.name,
            breadcrumbs: [
                { label: "Clients", href: "/clients" },
                { label: client.name },
            ],
            actions: null,
        });
    }, [client, setHeader]);

    if (isLoading) {
        return <div className="p-4">Loading client…</div>;
    }

    if (error) {
        return (
            <div className="p-4 text-destructive">
                Failed to load client.
            </div>
        );
    }

    if (!client) {
        return <div className="p-4">Client not found.</div>;
    }

    return (
        <div className="p-4 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <StatusBadge status={client.status} />
                    <h1 className="text-2xl font-semibold mt-2">
                        {client.name}
                    </h1>
                </div>

                <Button onClick={() => setCreateOpen(true)}>
                    Create Post
                </Button>
            </div>

            <DraftPostList clientId={client.id} />

            <CreateDraftPost
                clientId={client.id}
                open={createOpen}
                onOpenChange={setCreateOpen}
            />
        </div>
    );
}
