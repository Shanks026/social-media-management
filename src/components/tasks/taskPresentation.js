// Task status and priority, as the pieces a chip or dot needs: the label from
// the domain module, the colours from statusTone. A composer, not a map.
import { statusTone } from '@/lib/statusTone'
import { statusLabel, priorityLabel, PRIORITIES } from '@/lib/domain/taskStatus'

export function taskStatusCfg(status) {
  const tone = statusTone('task', status)
  return { label: statusLabel(status), className: tone.badge, dot: tone.dot }
}

export function taskPriorityCfg(priority) {
  if (!priority) return null
  const tone = statusTone('taskPriority', priority)
  return { label: priorityLabel(priority), dot: tone.dot, active: tone.badge }
}

/** Priority choices for pickers: [{ value, label, dot, active }], lowest first. */
export const TASK_PRIORITY_OPTIONS = PRIORITIES.map((value) => ({
  value,
  ...taskPriorityCfg(value),
}))
