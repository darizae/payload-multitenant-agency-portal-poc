import { describe, expect, it } from 'vitest'
import { canAccessPayloadAdmin, hasAutomaticAgencyWideCustomerAccess } from '@/lib/permissions'

describe('permissions', () => {
  it('allows platform and agency admins into payload admin', () => {
    expect(canAccessPayloadAdmin({ role: 'platform-admin' })).toBe(true)
    expect(canAccessPayloadAdmin({ role: 'agency-admin' })).toBe(true)
    expect(canAccessPayloadAdmin({ role: 'agency-manager' })).toBe(true)
    expect(canAccessPayloadAdmin({ role: 'customer-admin' })).toBe(false)
  })

  it('respects agency-wide customer access', () => {
    expect(hasAutomaticAgencyWideCustomerAccess({ role: 'agency-admin' })).toBe(true)
    expect(hasAutomaticAgencyWideCustomerAccess({ role: 'agency-user', hasGlobalCustomerAccess: true })).toBe(true)
    expect(hasAutomaticAgencyWideCustomerAccess({ role: 'agency-user', hasGlobalCustomerAccess: false })).toBe(false)
  })
})
