import { getPayloadClient } from '@/lib/payload'
import { canManageStoreUsers, canUserSeeStore } from '@/authz/ui-rules'
import { isAgencyRoot, isStoreheroRole } from '@/authz/roles'
import type { AppUserLike } from '@/lib/types'
import { getId } from '@/lib/utils'
import { getAssignedStoreIdsForUser } from '@/features/portal/shared/services'

export async function getStorePageData(user: AppUserLike, storeId: string | number) {
  const payload = await getPayloadClient()
  const resolvedStoreId = getId(storeId)
  if (typeof resolvedStoreId !== 'number') {
    return null
  }

  const assignedStoreIds = await getAssignedStoreIdsForUser(user)
  const storeResult = await payload.find({
    collection: 'stores',
    overrideAccess: true,
    depth: 1,
    limit: 1,
    where: { id: { equals: resolvedStoreId } },
  })
  const store = storeResult.docs[0]
  if (!store) {
    return null
  }

  if (!canUserSeeStore({ user, store, assignedStoreIds })) {
    return null
  }

  const canManageUsers = canManageStoreUsers({ user, store, assignedStoreIds })
  const canAssignAgencyUsers = isStoreheroRole(user) || isAgencyRoot(user)

  const [storeUsers, assignments, invites, agencyUsers] = await Promise.all([
    payload.find({ collection: 'users', overrideAccess: true, depth: 1, limit: 500, where: { store: { equals: resolvedStoreId } }, sort: 'name' }),
    payload.find({ collection: 'agency-store-assignments', overrideAccess: true, depth: 1, limit: 500, where: { store: { equals: resolvedStoreId } } }),
    canManageUsers
      ? payload.find({ collection: 'invite-tokens', overrideAccess: true, depth: 1, limit: 500, where: { store: { equals: resolvedStoreId } }, sort: '-createdAt' })
      : Promise.resolve({ docs: [] }),
    canAssignAgencyUsers
      ? payload.find({
        collection: 'users',
        overrideAccess: true,
        depth: 0,
        limit: 500,
        where: {
          and: [
            { agency: { equals: getId(store.agency) } },
            { role: { in: ['agency-root', 'agency-member'] } },
          ],
        },
        sort: 'name',
      })
      : Promise.resolve({ docs: [] }),
  ])

  return {
    store,
    storeUsers: storeUsers.docs,
    assignments: assignments.docs,
    agencyUsers: agencyUsers.docs,
    invites: invites.docs,
  }
}
