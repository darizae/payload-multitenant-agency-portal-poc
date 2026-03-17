import { AGENCY_ROLES, CUSTOMER_ROLES, HIGH_PRIVILEGE_ROLES, type UserRole } from '@/lib/constants'
import type { AppUserLike } from '@/lib/types'

export function getRole(user?: AppUserLike | null): UserRole | null {
  return (user?.role as UserRole | null | undefined) ?? null
}

export function isPlatformAdmin(user?: AppUserLike | null): boolean {
  return getRole(user) === 'platform-admin'
}

export function isAgencyRole(user?: AppUserLike | null): boolean {
  const role = getRole(user)
  return !!role && AGENCY_ROLES.includes(role)
}

export function isCustomerRole(user?: AppUserLike | null): boolean {
  const role = getRole(user)
  return !!role && CUSTOMER_ROLES.includes(role)
}

export function isAgencyAdmin(user?: AppUserLike | null): boolean {
  return getRole(user) === 'agency-admin'
}

export function isAgencyManager(user?: AppUserLike | null): boolean {
  return getRole(user) === 'agency-manager'
}

export function isAgencyStandardUser(user?: AppUserLike | null): boolean {
  return getRole(user) === 'agency-user'
}

export function isCustomerAdmin(user?: AppUserLike | null): boolean {
  return getRole(user) === 'customer-admin'
}

export function canAccessPayloadAdmin(user?: AppUserLike | null): boolean {
  const role = getRole(user)
  return !!role && HIGH_PRIVILEGE_ROLES.concat('agency-manager').includes(role as UserRole)
}

export function hasAutomaticAgencyWideCustomerAccess(user?: AppUserLike | null): boolean {
  return isPlatformAdmin(user) || isAgencyAdmin(user) || Boolean(user?.hasGlobalCustomerAccess)
}
