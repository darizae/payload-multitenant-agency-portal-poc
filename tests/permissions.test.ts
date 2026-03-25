import { describe, expect, it } from 'vitest'
import { canAccessPayloadAdmin, hasAutomaticAgencyWideStoreAccess } from '@/lib/permissions'

describe('permissions', () => {
  it('allows storehero and agency root roles into payload admin', () => {
    expect(canAccessPayloadAdmin({ role: 'storehero-root' })).toBe(true)
    expect(canAccessPayloadAdmin({ role: 'storehero-member' })).toBe(true)
    expect(canAccessPayloadAdmin({ role: 'agency-root' })).toBe(true)
    expect(canAccessPayloadAdmin({ role: 'agency-member' })).toBe(false)
    expect(canAccessPayloadAdmin({ role: 'store-root' })).toBe(false)
  })

  it('respects agency-wide store access', () => {
    expect(hasAutomaticAgencyWideStoreAccess({ role: 'agency-root' })).toBe(true)
    expect(hasAutomaticAgencyWideStoreAccess({ role: 'agency-member', hasGlobalStoreAccess: true })).toBe(true)
    expect(hasAutomaticAgencyWideStoreAccess({ role: 'agency-member', hasGlobalStoreAccess: false })).toBe(false)
  })
})
