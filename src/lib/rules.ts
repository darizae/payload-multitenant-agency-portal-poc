import { getRole, hasAutomaticAgencyWideCustomerAccess, isAgencyAdmin, isAgencyManager, isCustomerAdmin, isPlatformAdmin } from '@/lib/permissions'
import { getId, sameId } from '@/lib/utils'
import type { AppUserLike, CustomerLike } from '@/lib/types'

export function validateUserShape(user: AppUserLike): string[] {
  const errors: string[] = []
  const role = getRole(user)

  if (!role) {
    errors.push('User role is required.')
    return errors
  }

  if (role === 'platform-admin') {
    if (user.agency || user.customer) {
      errors.push('Platform admins cannot be attached to an agency or customer.')
    }
    return errors
  }

  if (role.startsWith('agency-') && !user.agency) {
    errors.push('Agency users must belong to an agency.')
  }

  if (role.startsWith('agency-') && user.customer) {
    errors.push('Agency users cannot be directly attached to a customer.')
  }

  if (role.startsWith('customer-') && !user.customer) {
    errors.push('Customer users must belong to a customer.')
  }

  if (role.startsWith('customer-') && !user.agency) {
    errors.push('Customer users must also carry the parent agency reference.')
  }

  return errors
}

export function canUserSeeCustomer(params: {
  user?: AppUserLike | null
  customer?: CustomerLike | null
  assignedCustomerIds?: Array<string | number>
}): boolean {
  const { user, customer, assignedCustomerIds = [] } = params
  if (!user || !customer) return false
  if (isPlatformAdmin(user)) return true

  const userAgencyId = getId(user.agency)
  const customerAgencyId = getId(customer.agency)
  if (!userAgencyId || !customerAgencyId || String(userAgencyId) !== String(customerAgencyId)) {
    return false
  }

  if (hasAutomaticAgencyWideCustomerAccess(user)) return true

  if (isCustomerAdmin(user) || getRole(user) === 'customer-user') {
    return sameId(user.customer, customer.id)
  }

  return assignedCustomerIds.map(String).includes(String(customer.id))
}

export function canManageAgencyUsers(user?: AppUserLike | null): boolean {
  return isPlatformAdmin(user) || isAgencyAdmin(user)
}

export function canManageCustomer(user?: AppUserLike | null, assignedToCustomer = false): boolean {
  if (isPlatformAdmin(user) || isAgencyAdmin(user) || isAgencyManager(user)) return true
  return getRole(user) === 'agency-user' && assignedToCustomer
}

export function canManageCustomerUsers(params: {
  user?: AppUserLike | null
  customer?: CustomerLike | null
  assignedCustomerIds?: Array<string | number>
}): boolean {
  const { user, customer, assignedCustomerIds = [] } = params
  if (!user || !customer) return false
  if (isPlatformAdmin(user)) return true
  const userAgencyId = getId(user.agency)
  const customerAgencyId = getId(customer.agency)
  if (!userAgencyId || !customerAgencyId || String(userAgencyId) !== String(customerAgencyId)) {
    return false
  }
  if (isAgencyAdmin(user)) return true
  if (isAgencyManager(user) || getRole(user) === 'agency-user') {
    return assignedCustomerIds.map(String).includes(String(customer.id))
  }
  return isCustomerAdmin(user) && sameId(user.customer, customer.id)
}

export function canAccessAgencyWorkspace(user?: AppUserLike | null): boolean {
  return isPlatformAdmin(user) || isAgencyAdmin(user) || isAgencyManager(user)
}

export function assertNoAgencyTransfer(params: {
  originalAgencyId?: string | number | null
  nextAgencyId?: string | number | null
}): string | null {
  const { originalAgencyId, nextAgencyId } = params
  if (originalAgencyId && nextAgencyId && String(originalAgencyId) !== String(nextAgencyId)) {
    return 'Customer transfer between agencies is forbidden in v1. Create a new customer under the target agency and migrate intentionally.'
  }
  return null
}

export function assertLastAgencyAdminProtection(params: {
  activeAgencyAdminCount: number
  originalRole?: string | null
  nextRole?: string | null
  originalStatus?: string | null
  nextStatus?: string | null
}): string | null {
  const { activeAgencyAdminCount, originalRole, nextRole, originalStatus, nextStatus } = params
  const wasProtected = originalRole === 'agency-admin' && originalStatus === 'active'
  const remainsProtected = nextRole === 'agency-admin' && nextStatus === 'active'
  if (wasProtected && !remainsProtected && activeAgencyAdminCount <= 1) {
    return 'You cannot remove, deactivate, or demote the last active agency admin.'
  }
  return null
}

export function assertLastCustomerAdminProtection(params: {
  activeCustomerAdminCount: number
  originalRole?: string | null
  nextRole?: string | null
  originalStatus?: string | null
  nextStatus?: string | null
}): string | null {
  const { activeCustomerAdminCount, originalRole, nextRole, originalStatus, nextStatus } = params
  const wasProtected = originalRole === 'customer-admin' && originalStatus === 'active'
  const remainsProtected = nextRole === 'customer-admin' && nextStatus === 'active'
  if (wasProtected && !remainsProtected && activeCustomerAdminCount <= 1) {
    return 'You cannot remove, deactivate, or demote the last active customer admin.'
  }
  return null
}
