import { describe, expect, it } from 'vitest'
import {
  assertLastAgencyRootProtection,
  assertLastStoreRootProtection,
  assertNoAgencyTransfer,
  canManageStoreUsers,
  canWriteMetricsForStore,
  canUserSeeStore,
  validateUserShape,
} from '@/authz/ui-rules'

describe('business rules', () => {
  it('blocks removing the last agency root user', () => {
    expect(
      assertLastAgencyRootProtection({
        activeAgencyRootCount: 1,
        originalRole: 'agency-root',
        nextRole: 'agency-member',
        originalStatus: 'active',
        nextStatus: 'active',
      }),
    ).toContain('last active agency root')
  })

  it('blocks removing the last store root user', () => {
    expect(
      assertLastStoreRootProtection({
        activeStoreRootCount: 1,
        originalRole: 'store-root',
        nextRole: 'store-member',
        originalStatus: 'active',
        nextStatus: 'active',
      }),
    ).toContain('last active store root')
  })

  it('forbids agency transfer', () => {
    expect(assertNoAgencyTransfer({ originalAgencyId: 'a', nextAgencyId: 'b' })).toContain('forbidden in v2')
  })

  it('validates tenant shape for store users', () => {
    const errors = validateUserShape({ role: 'store-root', agency: null, store: null })
    expect(errors.join(' ')).toContain('Store users must belong to a store')
  })

  it('allows agency root users to see any store in their agency', () => {
    expect(
      canUserSeeStore({
        user: { role: 'agency-root', agency: 'agency-1' },
        store: { id: 'store-1', agency: 'agency-1' },
      }),
    ).toBe(true)
  })

  it('restricts agency members to assigned stores', () => {
    expect(
      canUserSeeStore({
        user: { role: 'agency-member', agency: 'agency-1' },
        store: { id: 'store-1', agency: 'agency-1' },
        assignedStoreIds: ['store-2'],
      }),
    ).toBe(false)
  })

  it('restricts store members to their own store', () => {
    expect(
      canUserSeeStore({
        user: { role: 'store-member', agency: 'agency-1', store: 'store-1' },
        store: { id: 'store-2', agency: 'agency-1' },
      }),
    ).toBe(false)
  })

  it('blocks agency root users from managing store users across agencies', () => {
    expect(
      canManageStoreUsers({
        user: { role: 'agency-root', agency: 'agency-1' },
        store: { id: 'store-9', agency: 'agency-2' },
      }),
    ).toBe(false)
  })

  it('allows agency root users to manage store users in their own agency', () => {
    expect(
      canManageStoreUsers({
        user: { role: 'agency-root', agency: 'agency-1' },
        store: { id: 'store-9', agency: 'agency-1' },
      }),
    ).toBe(true)
  })

  it('restricts metric writes for agency members to assigned stores', () => {
    expect(
      canWriteMetricsForStore({
        user: { role: 'agency-member', agency: 'agency-1' },
        store: { id: 'store-1', agency: 'agency-1' },
        assignedStoreIds: ['store-2'],
      }),
    ).toBe(false)
  })

  it('allows store members to write metrics in their own store', () => {
    expect(
      canWriteMetricsForStore({
        user: { role: 'store-member', agency: 'agency-1', store: 'store-1' },
        store: { id: 'store-1', agency: 'agency-1' },
      }),
    ).toBe(true)
  })
})
