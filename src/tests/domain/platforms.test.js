import { describe, it, expect } from 'vitest'
import {
  PLATFORMS,
  ENABLED_PLATFORMS,
  platformById,
  platformId,
  platformLabel,
  platformLogo,
  platformChartConfig,
} from '@/lib/domain/platforms'

describe('platforms', () => {
  it('keeps the stored twitter id but labels it X', () => {
    expect(platformById('twitter').id).toBe('twitter')
    expect(platformLabel('twitter')).toBe('X')
  })

  it('lists Google Business, disabled', () => {
    const gb = PLATFORMS.find((p) => p.id === 'google_business')
    expect(gb).toMatchObject({ label: 'Google Business', enabled: false })
    expect(ENABLED_PLATFORMS.map((p) => p.id)).toEqual([
      'instagram',
      'linkedin',
      'facebook',
      'twitter',
      'youtube',
    ])
  })

  it('normalises ids', () => {
    expect(platformId('Google Business')).toBe('google_business')
    expect(platformId('LinkedIn')).toBe('linkedin')
    expect(platformId(null)).toBe('')
    expect(platformById('YouTube').label).toBe('YouTube')
  })

  it('falls back to the raw value for unknown platforms', () => {
    expect(platformLabel('mastodon')).toBe('mastodon')
    expect(platformLabel('')).toBe('')
  })

  it('points every logo at a correctly spelt file', () => {
    expect(platformLogo('google_business')).toBe('/platformIcons/google_business.png')
    expect(platformLogo('twitter')).toBe('/platformIcons/twitter.png')
  })

  it('builds a chart config with a theme pair for X', () => {
    const cfg = platformChartConfig('Deliverables')
    expect(cfg.posts.label).toBe('Deliverables')
    expect(cfg.instagram).toEqual({ label: 'Instagram', color: '#E4405F' })
    expect(cfg.twitter.label).toBe('X')
    expect(cfg.twitter.theme).toBeTruthy()
    expect(cfg.google_business).toBeUndefined()
  })
})
