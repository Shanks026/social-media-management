// Internal helper for the domain status modules: a label lookup that falls
// back to the raw value for anything unknown, and to '' for nothing.
export function labeler(labels) {
  return (value) => (value ? labels[value] ?? value : '')
}
