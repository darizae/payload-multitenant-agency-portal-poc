export const USER_ROLES = [
  'platform-admin',
  'agency-admin',
  'agency-manager',
  'agency-user',
  'customer-admin',
  'customer-user',
] as const

export const USER_STATUSES = ['invited', 'active', 'suspended', 'deactivated'] as const
export const AGENCY_STATUSES = ['active', 'inactive'] as const
export const CUSTOMER_STATUSES = ['active', 'inactive', 'suspended'] as const
export const ASSIGNMENT_STATUSES = ['active', 'inactive'] as const
export const INVITE_STATUSES = ['pending', 'used', 'expired', 'revoked'] as const

export type UserRole = (typeof USER_ROLES)[number]
export type UserStatus = (typeof USER_STATUSES)[number]
export type AgencyStatus = (typeof AGENCY_STATUSES)[number]
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number]

export const HIGH_PRIVILEGE_ROLES: UserRole[] = ['platform-admin', 'agency-admin']
export const AGENCY_ROLES: UserRole[] = ['agency-admin', 'agency-manager', 'agency-user']
export const CUSTOMER_ROLES: UserRole[] = ['customer-admin', 'customer-user']
