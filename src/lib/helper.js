/**
 * Format a date string into: 2 Jan, 2026
 */
export function formatDate(dateInput) {
    if (!dateInput) return "";

    const date = new Date(dateInput);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}
