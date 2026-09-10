/**
 * Where a notification points. Shared by the bell panel and the arrival
 * toaster so both land on the same screen for a given notification.
 *
 * `link` is authoritative when present — it's stamped on the row by the DB
 * triggers and can be more specific than anything derivable client-side
 * (e.g. a deep link to a single comment). The entity map is the fallback.
 */
export function resolveNotificationRoute(notification) {
  if (notification.link) return notification.link
  const { entity_type, entity_id } = notification
  if (!entity_type || !entity_id) return null
  const map = {
    post: `/deliverables`,
    task: `/tasks/${entity_id}`,
    campaign: `/campaigns/${entity_id}`,
    invoice: `/finance/invoices`,
    team: `/settings`,
  }
  return map[entity_type] ?? null
}
