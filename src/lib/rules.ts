import { getRole, hasAutomaticAgencyWideStoreAccess, isAgencyMember, isAgencyRoot, isStoreRoot, isStoreheroRole } from '@/lib/permissions'
import { getId, sameId } from '@/lib/utils'
import type { AppUserLike, StoreLike } from '@/lib/types'

export function validateUserShape(user: AppUserLike): string[] {
  const errors: string[] = []
  const role = getRole(user)

  if (!role) {
    errors.push('User role is required.')
    return errors
  }

  if (role.startsWith('storehero-')) {
    if (user.agency || user.store) {
      errors.push('Storehero users cannot be attached to an agency or store.')
    }
    return errors
  }

  if (role.startsWith('agency-') && !user.agency) {
    errors.push('Agency users must belong to an agency.')
  }

  if (role.startsWith('agency-') && user.store) {
    errors.push('Agency users cannot be directly attached to a store.')
  }

  if (role.startsWith('store-') && !user.store) {
    errors.push('Store users must belong to a store.')
  }

  if (role.startsWith('store-') && !user.agency) {
    errors.push('Store users must also carry the parent agency reference.')
  }

  return errors
}

export function canUserSeeStore(params: {
  user?: AppUserLike | null
  store?: StoreLike | null
  assignedStoreIds?: Array<string | number>
}): boolean {
  const { user, store, assignedStoreIds = [] } = params
  if (!user || !store) return false
  if (isStoreheroRole(user)) return true

  const userAgencyId = getId(user.agency)
  const storeAgencyId = getId(store.agency)
  if (!userAgencyId || !storeAgencyId || String(userAgencyId) !== String(storeAgencyId)) {
    return false
  }

  if (hasAutomaticAgencyWideStoreAccess(user)) return true

  if (isStoreRoot(user) || getRole(user) === 'store-member') {
    return sameId(user.store, store.id)
  }

  return assignedStoreIds.map(String).includes(String(store.id))
}

export function canManageAgencyUsers(user?: AppUserLike | null): boolean {
  return isStoreheroRole(user) || isAgencyRoot(user)
}

export function canManageStore(user?: AppUserLike | null, assignedToStore = false): boolean {
  if (isStoreheroRole(user) || isAgencyRoot(user)) return true
  return isAgencyMember(user) && assignedToStore
}

export function canManageStoreUsers(params: {
  user?: AppUserLike | null
  store?: StoreLike | null
  assignedStoreIds?: Array<string | number>
}): boolean {
  const { user, store, assignedStoreIds = [] } = params
  if (!user || !store) return false
  if (isStoreheroRole(user)) return true

  const userAgencyId = getId(user.agency)
  const storeAgencyId = getId(store.agency)
  if (!userAgencyId || !storeAgencyId || String(userAgencyId) !== String(storeAgencyId)) {
    return false
  }

  if (isAgencyRoot(user)) return true
  if (isAgencyMember(user)) {
    return assignedStoreIds.map(String).includes(String(store.id))
  }

  return isStoreRoot(user) && sameId(user.store, store.id)
}

export function canWriteMetricsForStore(params: {
  user?: AppUserLike | null
  store?: StoreLike | null
  assignedStoreIds?: Array<string | number>
}): boolean {
  return canUserSeeStore(params)
}

export function canAccessAgencyWorkspace(user?: AppUserLike | null): boolean {
  return isStoreheroRole(user) || isAgencyRoot(user) || isAgencyMember(user)
}

export function assertNoAgencyTransfer(params: {
  originalAgencyId?: string | number | null
  nextAgencyId?: string | number | null
}): string | null {
  const { originalAgencyId, nextAgencyId } = params
  if (originalAgencyId && nextAgencyId && String(originalAgencyId) !== String(nextAgencyId)) {
    return 'Store transfer between agencies is forbidden in v2. Create a new store under the target agency and migrate intentionally.'
  }
  return null
}

export function assertLastAgencyRootProtection(params: {
  activeAgencyRootCount: number
  originalRole?: string | null
  nextRole?: string | null
  originalStatus?: string | null
  nextStatus?: string | null
}): string | null {
  const { activeAgencyRootCount, originalRole, nextRole, originalStatus, nextStatus } = params
  const wasProtected = originalRole === 'agency-root' && originalStatus === 'active'
  const remainsProtected = nextRole === 'agency-root' && nextStatus === 'active'
  if (wasProtected && !remainsProtected && activeAgencyRootCount <= 1) {
    return 'You cannot remove, deactivate, or demote the last active agency root user.'
  }
  return null
}

export function assertLastStoreRootProtection(params: {
  activeStoreRootCount: number
  originalRole?: string | null
  nextRole?: string | null
  originalStatus?: string | null
  nextStatus?: string | null
}): string | null {
  const { activeStoreRootCount, originalRole, nextRole, originalStatus, nextStatus } = params
  const wasProtected = originalRole === 'store-root' && originalStatus === 'active'
  const remainsProtected = nextRole === 'store-root' && nextStatus === 'active'
  if (wasProtected && !remainsProtected && activeStoreRootCount <= 1) {
    return 'You cannot remove, deactivate, or demote the last active store root user.'
  }
  return null
}
