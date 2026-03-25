import { describe, expect, it } from 'vitest'
import {
  validateAssignmentWritePermissions,
  validateStoreWritePermissions,
  validateUserWritePermissions,
} from '@/lib/guards'

describe('guard permissions', () => {
  it('blocks store root users from creating agency roles', () => {
    expect(() =>
      validateUserWritePermissions({
        actor: { role: 'store-root', agency: 'agency-1', store: 'store-1' },
        operation: 'create',
        nextData: {
          role: 'agency-root',
          agency: 'agency-1',
          store: 'store-1',
        },
      }),
    ).toThrow()
  })

  it('blocks agency root users from creating storehero users', () => {
    expect(() =>
      validateUserWritePermissions({
        actor: { role: 'agency-root', agency: 'agency-1' },
        operation: 'create',
        nextData: {
          role: 'storehero-root',
          agency: 'agency-1',
        },
      }),
    ).toThrow()
  })

  it('allows agency members to create store users in their own agency', () => {
    expect(() =>
      validateUserWritePermissions({
        actor: { role: 'agency-member', agency: 'agency-1' },
        operation: 'create',
        nextData: {
          role: 'store-member',
          agency: 'agency-1',
          store: 'store-1',
        },
      }),
    ).not.toThrow()
  })

  it('blocks agency members from creating agency roles', () => {
    expect(() =>
      validateUserWritePermissions({
        actor: { role: 'agency-member', agency: 'agency-1' },
        operation: 'create',
        nextData: {
          role: 'agency-member',
          agency: 'agency-1',
        },
      }),
    ).toThrow()
  })

  it('blocks agency root users from writing stores outside their agency', () => {
    expect(() =>
      validateStoreWritePermissions({
        actor: { role: 'agency-root', agency: 'agency-1' },
        operation: 'update',
        originalDoc: { id: 'store-2', agency: 'agency-2' },
        nextData: {},
      }),
    ).toThrow()
  })

  it('blocks agency root users from writing assignments outside their agency', () => {
    expect(() =>
      validateAssignmentWritePermissions({
        actor: { role: 'agency-root', agency: 'agency-1' },
        assignmentAgency: 'agency-2',
      }),
    ).toThrow()
  })
})
