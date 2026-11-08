import { describe, it, expect } from 'vitest'
import { resolveNotificationRoute } from '@/components/notifications/routes'

// B14: team notifications pointed at Settings, which has no Team tab (an
// unknown ?tab= falls back to Profile). Team is its own route.
describe('resolveNotificationRoute', () => {
  it('sends team notifications to the Team page', () => {
    expect(resolveNotificationRoute({ entity_type: 'team', entity_id: null, link: '/team' })).toBe('/team')
    expect(resolveNotificationRoute({ entity_type: 'team', entity_id: null, link: null })).toBe('/team')
    // older rows stamped with a Settings link
    expect(resolveNotificationRoute({ entity_type: 'team', link: '/settings?tab=team' })).toBe('/team')
  })

  it('still prefers the stamped link for other entities', () => {
    expect(resolveNotificationRoute({ entity_type: 'post', entity_id: 'p1', link: '/clients/c/deliverables/p1?comment=9' }))
      .toBe('/clients/c/deliverables/p1?comment=9')
    expect(resolveNotificationRoute({ entity_type: 'task', entity_id: 't1', link: null })).toBe('/tasks/t1')
  })
})
