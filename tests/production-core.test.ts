import { describe, expect, it } from 'vitest'

import {
  FREE_HISTORY_RETENTION_DAYS,
  getHistoryRetentionDays,
  hasFeature,
  normalizePlan,
} from '../shared/entitlements'
import { isAllowedExternalUrl } from '../electron/urlSafety'
import { DEFAULT_PRODUCTION_API_URL } from '../electron/app-config'

describe('entitlements', () => {
  it('keeps free history at 30 days', () => {
    expect(FREE_HISTORY_RETENTION_DAYS).toBe(30)
    expect(getHistoryRetentionDays('free')).toBe(30)
    expect(getHistoryRetentionDays('pro')).toBe(Number.POSITIVE_INFINITY)
  })

  it('normalizes unknown plans to free', () => {
    expect(normalizePlan('nope')).toBe('free')
    expect(normalizePlan('pro_plus')).toBe('pro_plus')
  })

  it('gates communities to Pro+', () => {
    expect(hasFeature('free', 'communities')).toBe(false)
    expect(hasFeature('pro', 'communities')).toBe(false)
    expect(hasFeature('pro_plus', 'communities')).toBe(true)
  })
})

describe('urlSafety', () => {
  it('allows https and mailto', () => {
    expect(isAllowedExternalUrl('https://www.clarifiapp.com/desktop/sign-in')).toBe(true)
    expect(isAllowedExternalUrl('mailto:hello@clarifiapp.com')).toBe(true)
  })

  it('allows localhost http for local pairing', () => {
    expect(isAllowedExternalUrl('http://localhost:3000/desktop/sign-in')).toBe(true)
    expect(isAllowedExternalUrl('http://127.0.0.1:3000/desktop/connect')).toBe(true)
  })

  it('blocks dangerous schemes', () => {
    expect(isAllowedExternalUrl('file:///etc/passwd')).toBe(false)
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedExternalUrl('http://evil.example')).toBe(false)
  })

  it('allows common video-call links used by calendar "Join & Record"', () => {
    expect(isAllowedExternalUrl('https://zoom.us/j/1234567890')).toBe(true)
    expect(isAllowedExternalUrl('https://meet.google.com/abc-defg-hij')).toBe(true)
    expect(
      isAllowedExternalUrl('https://teams.microsoft.com/l/meetup-join/abc'),
    ).toBe(true)
  })
})

describe('app-config', () => {
  it('points packaged builds at clarifiapp.com', () => {
    expect(DEFAULT_PRODUCTION_API_URL).toBe('https://www.clarifiapp.com')
  })
})

describe('public routes', () => {
  it('allows desktop auth and trust pages without session', async () => {
    const { isPublicPath } = await import('../web/src/lib/protected-routes')
    expect(isPublicPath('/desktop/auth')).toBe(true)
    expect(isPublicPath('/trust')).toBe(true)
    expect(isPublicPath('/desktop/connect')).toBe(true)
    expect(isPublicPath('/privacy')).toBe(true)
  })
})

describe('enhance queue', () => {
  it('queues and clears meeting retries', async () => {
    const {
      queueEnhanceRetry,
      clearEnhanceRetry,
      getPendingEnhanceIds,
    } = await import('../electron/enhanceQueue')
    queueEnhanceRetry('meeting-1')
    expect(getPendingEnhanceIds()).toContain('meeting-1')
    clearEnhanceRetry('meeting-1')
    expect(getPendingEnhanceIds()).not.toContain('meeting-1')
  })
})
