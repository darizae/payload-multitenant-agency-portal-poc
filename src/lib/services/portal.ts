import { getPayloadClient } from '@/lib/payload'
import { canAccessAgencyWorkspace, canManageStoreUsers, canUserSeeStore } from '@/lib/rules'
import { hasAutomaticAgencyWideStoreAccess, isAgencyRoot, isStoreheroRole } from '@/lib/permissions'
import type { AppUserLike } from '@/lib/types'
import { getId } from '@/lib/utils'

export async function getAssignedStoreIdsForUser(user?: AppUserLike | null): Promise<Array<string | number>> {
  const payload = await getPayloadClient()
  const userId = getId(user?.id)
  if (!userId) return []

  const result = await payload.find({
    collection: 'agency-store-assignments',
    overrideAccess: true,
    depth: 0,
    limit: 500,
    where: {
      and: [
        { agencyUser: { equals: userId } },
        { status: { equals: 'active' } },
      ],
    },
  })

  return result.docs.map((doc: any) => doc.store).filter(Boolean)
}

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

export async function getAgencyPageData(user: AppUserLike, agencyId: string | number) {
  const payload = await getPayloadClient()
  const resolvedAgencyId = getId(agencyId)
  if (!canAccessAgencyWorkspace(user)) {
    return null
  }
  if (typeof resolvedAgencyId !== 'number') {
    return null
  }

  if (!isStoreheroRole(user) && getId(user.agency) !== resolvedAgencyId) {
    return null
  }

  const agencyResult = await payload.find({
    collection: 'agencies',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { id: { equals: resolvedAgencyId } },
  })
  const agency = agencyResult.docs[0]
  if (!agency) {
    return null
  }

  const [stores, users, assignments, invites] = await Promise.all([
    payload.find({ collection: 'stores', overrideAccess: true, depth: 1, limit: 500, sort: 'name', where: { agency: { equals: resolvedAgencyId } } }),
    payload.find({ collection: 'users', overrideAccess: true, depth: 1, limit: 500, sort: 'name', where: { agency: { equals: resolvedAgencyId } } }),
    payload.find({ collection: 'agency-store-assignments', overrideAccess: true, depth: 1, limit: 500, where: { agency: { equals: resolvedAgencyId } } }),
    isStoreheroRole(user) || isAgencyRoot(user)
      ? payload.find({ collection: 'invite-tokens', overrideAccess: true, depth: 1, limit: 500, sort: '-createdAt', where: { agency: { equals: resolvedAgencyId } } })
      : Promise.resolve({ docs: [] }),
  ])

  return { agency, stores: stores.docs, users: users.docs, assignments: assignments.docs, invites: invites.docs }
}

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

export async function getAgencyBrandingForUser(user: AppUserLike): Promise<{
  primaryColor?: string | null
  secondaryColor?: string | null
  logoUrl?: string | null
  agencyName?: string | null
} | null> {
  if (isStoreheroRole(user)) {
    return null
  }

  const agencyId = getId(user.agency)
  if (!agencyId) return null

  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'agencies',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { id: { equals: agencyId } },
  })

  const agency = result.docs[0]
  if (!agency) return null

  return {
    primaryColor: agency.brandingPrimaryColor,
    secondaryColor: agency.brandingSecondaryColor,
    logoUrl: agency.brandingLogoUrl,
    agencyName: agency.name,
  }
}
