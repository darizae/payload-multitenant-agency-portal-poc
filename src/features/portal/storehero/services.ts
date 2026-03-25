import { getPayloadClient } from '@/lib/payload'
import { hasAutomaticAgencyWideStoreAccess, isAgencyRoot, isStoreheroRole } from '@/authz/roles'
import type { AppUserLike } from '@/lib/types'
import { getId } from '@/lib/utils'
import { getAssignedStoreIdsForUser } from '@/features/portal/shared/services'

export async function getVisibleAgencies(user: AppUserLike) {
  const payload = await getPayloadClient()
  if (isStoreheroRole(user)) {
    return payload.find({ collection: 'agencies', overrideAccess: true, depth: 0, limit: 100 })
  }

  const agencyId = getId(user.agency)
  if (!agencyId) {
    return { docs: [], totalDocs: 0 }
  }

  return payload.find({
    collection: 'agencies',
    overrideAccess: true,
    depth: 0,
    where: { id: { equals: agencyId } },
    limit: 1,
  })
}

export async function getVisibleStores(user: AppUserLike) {
  const payload = await getPayloadClient()
  if (isStoreheroRole(user)) {
    return payload.find({ collection: 'stores', overrideAccess: true, depth: 1, limit: 500, sort: 'name' })
  }

  const agencyId = getId(user.agency)
  if (!agencyId) return { docs: [], totalDocs: 0 }

  if (user.role === 'store-root' || user.role === 'store-member') {
    const storeId = getId(user.store)
    if (!storeId) return { docs: [], totalDocs: 0 }
    return payload.find({
      collection: 'stores',
      overrideAccess: true,
      depth: 1,
      limit: 1,
      where: { id: { equals: storeId } },
    })
  }

  if (hasAutomaticAgencyWideStoreAccess(user)) {
    return payload.find({
      collection: 'stores',
      overrideAccess: true,
      depth: 1,
      limit: 500,
      sort: 'name',
      where: { agency: { equals: agencyId } },
    })
  }

  const assignedStoreIds = await getAssignedStoreIdsForUser(user)
  if (assignedStoreIds.length === 0) return { docs: [], totalDocs: 0 }
  return payload.find({
    collection: 'stores',
    overrideAccess: true,
    depth: 1,
    limit: 500,
    sort: 'name',
    where: {
      and: [
        { agency: { equals: agencyId } },
        { id: { in: assignedStoreIds } },
      ],
    },
  })
}

export async function getDashboardStats(user: AppUserLike) {
  const agencies = await getVisibleAgencies(user)
  const stores = await getVisibleStores(user)
  const payload = await getPayloadClient()

  let userCount = 0
  if (isStoreheroRole(user)) {
    userCount = (await payload.count({ collection: 'users', overrideAccess: true, where: {} })).totalDocs
  } else if (user.role === 'store-root' || user.role === 'store-member') {
    const storeId = getId(user.store)
    userCount = storeId
      ? (await payload.count({ collection: 'users', overrideAccess: true, where: { store: { equals: storeId } } })).totalDocs
      : 0
  } else if (isAgencyRoot(user) || hasAutomaticAgencyWideStoreAccess(user)) {
    const agencyId = getId(user.agency)
    userCount = agencyId
      ? (await payload.count({ collection: 'users', overrideAccess: true, where: { agency: { equals: agencyId } } })).totalDocs
      : 0
  } else {
    const agencyId = getId(user.agency)
    const userId = getId(user.id)
    const assignedStoreIds = await getAssignedStoreIdsForUser(user)
    if (!userId) {
      userCount = 0
    } else if (!agencyId || assignedStoreIds.length === 0) {
      userCount = (await payload.count({ collection: 'users', overrideAccess: true, where: { id: { equals: userId } } })).totalDocs
    } else {
      userCount = (await payload.count({
        collection: 'users',
        overrideAccess: true,
        where: {
          and: [
            { agency: { equals: agencyId } },
            {
              or: [
                { id: { equals: userId } },
                { store: { in: assignedStoreIds } },
              ],
            },
          ],
        },
      })).totalDocs
    }
  }

  return {
    agencies: agencies.totalDocs,
    stores: stores.totalDocs,
    users: userCount,
  }
}
