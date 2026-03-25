import type { Access, Where } from 'payload'
import { canAccessPayloadAdmin, hasAutomaticAgencyWideStoreAccess, isAgencyMember, isAgencyRoot, isStoreRoot, isStoreheroRole } from '@/lib/permissions'
import type { AppUserLike } from '@/lib/types'
import { getId } from '@/lib/utils'

export async function getAssignedStoreIds(req: { user?: AppUserLike | null; payload?: any }): Promise<Array<string | number>> {
  const userId = getId(req.user?.id)
  if (!userId || !req.payload) return []

  const assignments = await req.payload.find({
    collection: 'agency-store-assignments',
    depth: 0,
    limit: 500,
    overrideAccess: true,
    where: {
      and: [
        { agencyUser: { equals: userId } },
        { status: { equals: 'active' } },
      ],
    },
  })

  return (assignments.docs || []).map((doc: any) => doc.store).filter(Boolean)
}

export const canAccessAdminPanel = ({ req }: { req: any }) => {
  return canAccessPayloadAdmin(req.user as AppUserLike | undefined)
}

export const agenciesReadAccess: Access = ({ req }) => {
  const user = req.user as AppUserLike | undefined
  if (!user) return false
  if (isStoreheroRole(user)) return true
  const agencyId = getId(user.agency)
  return agencyId ? { id: { equals: agencyId } } : false
}

export const storesReadAccess: Access = async ({ req }) => {
  const user = req.user as AppUserLike | undefined
  if (!user) return false
  if (isStoreheroRole(user)) return true

  if (isStoreRoot(user) || user.role === 'store-member') {
    const storeId = getId(user.store)
    return storeId ? { id: { equals: storeId } } : false
  }

  const agencyId = getId(user.agency)
  if (!agencyId) return false

  if (hasAutomaticAgencyWideStoreAccess(user)) {
    return { agency: { equals: agencyId } }
  }

  const assignedStoreIds = await getAssignedStoreIds(req)
  if (assignedStoreIds.length === 0) {
    return { id: { equals: '__none__' } }
  }

  return {
    and: [
      { agency: { equals: agencyId } },
      { id: { in: assignedStoreIds } },
    ],
  } satisfies Where
}

export const usersReadAccess: Access = async ({ req }) => {
  const user = req.user as AppUserLike | undefined
  if (!user) return false
  if (isStoreheroRole(user)) return true

  if (isStoreRoot(user)) {
    const storeId = getId(user.store)
    if (!storeId) {
      return { id: { equals: getId(user.id) } }
    }
    return {
      or: [
        { id: { equals: getId(user.id) } },
        { store: { equals: storeId } },
      ],
    }
  }

  if (user.role === 'store-member') {
    return { id: { equals: getId(user.id) } }
  }

  const agencyId = getId(user.agency)
  if (!agencyId) return false

  if (isAgencyRoot(user)) {
    return { agency: { equals: agencyId } }
  }

  const assignedStoreIds = await getAssignedStoreIds(req)
  if (assignedStoreIds.length === 0) {
    return { id: { equals: getId(user.id) } }
  }
  return {
    and: [
      { agency: { equals: agencyId } },
      {
        or: [
          { id: { equals: getId(user.id) } },
          { store: { in: assignedStoreIds } },
        ],
      },
    ],
  }
}

export const auditLogReadAccess: Access = ({ req }) => {
  const user = req.user as AppUserLike | undefined
  if (!user) return false
  if (isStoreheroRole(user)) return true
  if (isAgencyRoot(user) || isAgencyMember(user)) {
    const agencyId = getId(user.agency)
    return agencyId ? { agency: { equals: agencyId } } : false
  }
  const storeId = getId(user.store)
  return storeId ? { store: { equals: storeId } } : false
}

export const metricsReadAccess: Access = async ({ req }) => {
  const user = req.user as AppUserLike | undefined
  if (!user) return false
  if (isStoreheroRole(user)) return true

  if (isStoreRoot(user) || user.role === 'store-member') {
    const storeId = getId(user.store)
    return storeId ? { store: { equals: storeId } } : false
  }

  const agencyId = getId(user.agency)
  if (!agencyId) return false

  if (hasAutomaticAgencyWideStoreAccess(user)) {
    return { tenant: { equals: agencyId } }
  }

  const assignedStoreIds = await getAssignedStoreIds(req)
  if (assignedStoreIds.length === 0) {
    return { id: { equals: '__none__' } }
  }

  return {
    and: [
      { tenant: { equals: agencyId } },
      { store: { in: assignedStoreIds } },
    ],
  } satisfies Where
}
