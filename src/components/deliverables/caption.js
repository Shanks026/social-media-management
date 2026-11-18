import { createElement } from 'react'

/**
 * Renders a post caption with hashtags highlighted in blue.
 * Returns an array of strings and React elements suitable for rendering.
 */
export function renderCaption(text) {
  if (!text) return 'No description provided.'
  return text.split(/(#\w+)/g).map((part, i) =>
    part.startsWith('#')
      ? createElement('span', { key: i, className: 'text-blue-500' }, part)
      : part
  )
}
