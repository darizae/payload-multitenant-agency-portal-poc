import { AGENCY_ROLES, HIGH_PRIVILEGE_ROLES, STORE_ROLES, type UserRole } from '@/lib/constants'
import type { AppUserLike } from '@/lib/types'

export function getRole(user?: AppUserLike | null): UserRole | null {
  return (user?.role as UserRole | null | undefined) ?? null
}

export function isStoreheroRoot(user?: AppUserLike | null): boolean {
  return getRole(user) === 'storehero-root'
}

export function isStoreheroMember(user?: AppUserLike | null): boolean {
  return getRole(user) === 'storehero-member'
}

export function isStoreheroRole(user?: AppUserLike | null): boolean {
  return isStoreheroRoot(user) || isStoreheroMember(user)
}

export function isAgencyRole(user?: AppUserLike | null): boolean {
  const role = getRole(user)
  return !!role && AGENCY_ROLES.includes(role)
}

export function isStoreRole(user?: AppUserLike | null): boolean {
  const role = getRole(user)
  return !!role && STORE_ROLES.includes(role)
}

export function isAgencyRoot(user?: AppUserLike | null): boolean {
  return getRole(user) === 'agency-root'
}

export function isAgencyMember(user?: AppUserLike | null): boolean {
  return getRole(user) === 'agency-member'
}

export function isStoreRoot(user?: AppUserLike | null): boolean {
  return getRole(user) === 'store-root'
}

export function isStoreMember(user?: AppUserLike | null): boolean {
  return getRole(user) === 'store-member'
}

export function canAccessPayloadAdmin(user?: AppUserLike | null): boolean {
  const role = getRole(user)
  return !!role && HIGH_PRIVILEGE_ROLES.includes(role as UserRole)
}

export function hasAutomaticAgencyWideStoreAccess(user?: AppUserLike | null): boolean {
  return isStoreheroRole(user) || isAgencyRoot(user) || Boolean(user?.hasGlobalStoreAccess)
}
