import { Badge } from "@/components/ui/badge";

function StatusBadge({ status }) {
    const config = {
        ACTIVE: {
            label: "Active",
            dotClass: "bg-emerald-500",
        },
        PAUSED: {
            label: "Paused",
            dotClass: "bg-amber-500",
        },
        INACTIVE: {
            label: "Inactive",
            dotClass: "bg-slate-500",
        },
        DRAFT: {
            label: "Draft",
            dotClass: "bg-blue-500",
        },
    };

    const { label, dotClass } = config[status] ?? config.INACTIVE;

    return (
        <Badge
            variant="outline"
            className="flex items-center gap-2 rounded-md py-1 text-xs"
        >
            {/* Status dot */}
            <span
                className={`size-2 rounded-full ${dotClass}`}
                aria-hidden
            />

            <span className="text-xs font-medium">{label}</span>
        </Badge>
    );
}

export default StatusBadge;
