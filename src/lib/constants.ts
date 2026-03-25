export const USER_ROLES = [
  'storehero-root',
  'storehero-member',
  'agency-root',
  'agency-member',
  'store-root',
  'store-member',
] as const

export const USER_STATUSES = ['invited', 'active', 'suspended', 'deactivated'] as const
export const AGENCY_STATUSES = ['active', 'inactive'] as const
export const STORE_STATUSES = ['active', 'inactive', 'suspended'] as const
export const ASSIGNMENT_STATUSES = ['active', 'inactive'] as const
export const INVITE_STATUSES = ['pending', 'used', 'expired', 'revoked'] as const

export type UserRole = (typeof USER_ROLES)[number]
export type UserStatus = (typeof USER_STATUSES)[number]
export type AgencyStatus = (typeof AGENCY_STATUSES)[number]
export type StoreStatus = (typeof STORE_STATUSES)[number]

export const HIGH_PRIVILEGE_ROLES: UserRole[] = ['storehero-root', 'storehero-member', 'agency-root']
export const AGENCY_ROLES: UserRole[] = ['agency-root', 'agency-member']
export const STORE_ROLES: UserRole[] = ['store-root', 'store-member']
