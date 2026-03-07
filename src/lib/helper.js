/**
 * Maximum file size allowed for document uploads (50 MB).
 * Change this constant to update the limit across the entire app.
 */
export const MAX_DOCUMENT_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

/**
 * Format a byte count into a human-readable size string.
 * e.g. 2457600 → "2.3 MB"
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value % 1 === 0 ? value : value.toFixed(1)} ${units[i]}`
}

/**
 * Derives a display-level publish state from a post version.
 * Returns the DB status for single-date posts.
 * Returns 'PARTIALLY_PUBLISHED' (UI-only) when some but not all platforms are published.
 */
export function getPublishState(version) {
  if (!version?.platform_schedules) return version?.status
  const entries = Object.values(version.platform_schedules)
  if (!entries.length) return version.status
  const publishedCount = entries.filter((e) => e.published_at).length
  if (publishedCount === 0) return version.status
  if (publishedCount === entries.length) return 'PUBLISHED'
  return 'PARTIALLY_PUBLISHED'
}

/**
 * Returns the effective scheduled_at for a given platform.
 * Falls back to target_date when platform_schedules is absent.
 */
export function effectivePlatformDate(version, platform) {
  return version?.platform_schedules?.[platform]?.scheduled_at ?? version?.target_date
}

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
