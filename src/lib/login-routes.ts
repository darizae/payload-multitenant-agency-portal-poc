import { USER_ROLES, type UserRole } from '@/lib/constants'

export type RoleLoginConfig = {
  role: UserRole
  label: string
  description: string
  demoEmail: string
}

const ROLE_LOGIN_CONFIG: Record<UserRole, RoleLoginConfig> = {
  'storehero-root': {
    role: 'storehero-root',
    label: 'Storehero Root',
    description: 'Platform-wide administration login.',
    demoEmail: 'storehero.root@poc.local',
  },
  'storehero-member': {
    role: 'storehero-member',
    label: 'Storehero Member',
    description: 'Cross-tenant operator login.',
    demoEmail: 'storehero.member@poc.local',
  },
  'agency-root': {
    role: 'agency-root',
    label: 'Agency Root',
    description: 'Agency administrator login.',
    demoEmail: 'aurora.agency+root@poc.local',
  },
  'agency-member': {
    role: 'agency-member',
    label: 'Agency Member',
    description: 'Agency workspace member login.',
    demoEmail: 'aurora.agency+member@poc.local',
  },
  'store-root': {
    role: 'store-root',
    label: 'Store Root',
    description: 'Store administrator login.',
    demoEmail: 'aurora.bikes+root@poc.local',
  },
  'store-member': {
    role: 'store-member',
    label: 'Store Member',
    description: 'Store operations member login.',
    demoEmail: 'aurora.bikes+member@poc.local',
  },
}

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole)
}

export function getRoleLoginConfig(role: string): RoleLoginConfig | null {
  if (!isUserRole(role)) return null
  return ROLE_LOGIN_CONFIG[role]
}

export function getRoleLoginConfigs(): RoleLoginConfig[] {
  return USER_ROLES.map((role) => ROLE_LOGIN_CONFIG[role])
}
