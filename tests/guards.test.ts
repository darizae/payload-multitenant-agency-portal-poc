import { describe, expect, it } from 'vitest'
import {
  validateAssignmentWritePermissions,
  validateCustomerWritePermissions,
  validateUserWritePermissions,
} from '@/lib/guards'

describe('guard permissions', () => {
  it('blocks customer admins from creating agency roles', () => {
    expect(() =>
      validateUserWritePermissions({
        actor: { role: 'customer-admin', agency: 'agency-1', customer: 'customer-1' },
        operation: 'create',
        nextData: {
          role: 'agency-admin',
          agency: 'agency-1',
          customer: 'customer-1',
        },
      }),
    ).toThrow()
  })

  it('blocks agency admins from creating platform admins', () => {
    expect(() =>
      validateUserWritePermissions({
        actor: { role: 'agency-admin', agency: 'agency-1' },
        operation: 'create',
        nextData: {
          role: 'platform-admin',
          agency: 'agency-1',
        },
      }),
    ).toThrow()
  })

  it('allows agency users to create customer users in their own agency', () => {
    expect(() =>
      validateUserWritePermissions({
        actor: { role: 'agency-user', agency: 'agency-1' },
        operation: 'create',
        nextData: {
          role: 'customer-user',
          agency: 'agency-1',
          customer: 'customer-1',
        },
      }),
    ).not.toThrow()
  })

  it('blocks agency users from creating agency roles', () => {
    expect(() =>
      validateUserWritePermissions({
        actor: { role: 'agency-user', agency: 'agency-1' },
        operation: 'create',
        nextData: {
          role: 'agency-user',
          agency: 'agency-1',
        },
      }),
    ).toThrow()
  })

  it('blocks agency admins from writing customers outside their agency', () => {
    expect(() =>
      validateCustomerWritePermissions({
        actor: { role: 'agency-admin', agency: 'agency-1' },
        operation: 'update',
        originalDoc: { id: 'customer-2', agency: 'agency-2' },
        nextData: {},
      }),
    ).toThrow()
  })

  it('blocks agency admins from writing assignments outside their agency', () => {
    expect(() =>
      validateAssignmentWritePermissions({
        actor: { role: 'agency-admin', agency: 'agency-1' },
        assignmentAgency: 'agency-2',
      }),
    ).toThrow()
  })
})
