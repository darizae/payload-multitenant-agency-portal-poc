import type { UserRole, UserStatus } from '@/lib/constants'

export type ID = number | string

export type AppUserLike = {
  id?: ID
  email?: string | null
  role?: UserRole | null
  status?: UserStatus | null
  agency?: ID | { id?: ID; name?: string | null; status?: string | null } | null
  customer?: ID | { id?: ID; name?: string | null; status?: string | null; agency?: ID | { id?: ID } | null } | null
  hasGlobalCustomerAccess?: boolean | null
  name?: string | null
}

export type AgencyLike = {
  id?: ID
  name?: string | null
  status?: string | null
}

export type CustomerLike = {
  id?: ID
  name?: string | null
  status?: string | null
  agency?: ID | AgencyLike | null
}
