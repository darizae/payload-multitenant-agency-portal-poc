import { describe, expect, it } from 'vitest'
import {
  assertLastAgencyAdminProtection,
  assertLastCustomerAdminProtection,
  assertNoAgencyTransfer,
  canUserSeeCustomer,
  validateUserShape,
} from '@/lib/rules'

describe('business rules', () => {
  it('blocks removing the last agency admin', () => {
    expect(
      assertLastAgencyAdminProtection({
        activeAgencyAdminCount: 1,
        originalRole: 'agency-admin',
        nextRole: 'agency-user',
        originalStatus: 'active',
        nextStatus: 'active',
      }),
    ).toContain('last active agency admin')
  })

  it('blocks removing the last customer admin', () => {
    expect(
      assertLastCustomerAdminProtection({
        activeCustomerAdminCount: 1,
        originalRole: 'customer-admin',
        nextRole: 'customer-user',
        originalStatus: 'active',
        nextStatus: 'active',
      }),
    ).toContain('last active customer admin')
  })

  it('forbids agency transfer', () => {
    expect(assertNoAgencyTransfer({ originalAgencyId: 'a', nextAgencyId: 'b' })).toContain('forbidden in v1')
  })

  it('validates tenant shape for customer users', () => {
    const errors = validateUserShape({ role: 'customer-admin', agency: null, customer: null })
    expect(errors.join(' ')).toContain('Customer users must belong to a customer')
  })

  it('allows agency admins to see any customer in their agency', () => {
    expect(
      canUserSeeCustomer({
        user: { role: 'agency-admin', agency: 'agency-1' },
        customer: { id: 'cust-1', agency: 'agency-1' },
      }),
    ).toBe(true)
  })

  it('restricts agency standard users to assigned customers', () => {
    expect(
      canUserSeeCustomer({
        user: { role: 'agency-user', agency: 'agency-1' },
        customer: { id: 'cust-1', agency: 'agency-1' },
        assignedCustomerIds: ['cust-2'],
      }),
    ).toBe(false)
  })

  it('restricts customer users to their own customer', () => {
    expect(
      canUserSeeCustomer({
        user: { role: 'customer-user', agency: 'agency-1', customer: 'cust-1' },
        customer: { id: 'cust-2', agency: 'agency-1' },
      }),
    ).toBe(false)
  })
})
