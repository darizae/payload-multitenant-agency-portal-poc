import type { Access, Where } from 'payload'
import { canAccessPayloadAdmin, hasAutomaticAgencyWideCustomerAccess, isAgencyAdmin, isAgencyManager, isCustomerAdmin, isPlatformAdmin } from '@/lib/permissions'
import type { AppUserLike } from '@/lib/types'
import { getId } from '@/lib/utils'

async function getAssignedCustomerIds(req: { user?: AppUserLike | null; payload?: any }): Promise<Array<string | number>> {
  const userId = getId(req.user?.id)
  if (!userId || !req.payload) return []

  const assignments = await req.payload.find({
    collection: 'agency-customer-assignments',
    depth: 0,
    limit: 200,
    overrideAccess: true,
    where: {
      and: [
        { agencyUser: { equals: userId } },
        { status: { equals: 'active' } },
      ],
    },
  })

  return (assignments.docs || []).map((doc: any) => doc.customer).filter(Boolean)
}

export const canAccessAdminPanel = ({ req }: { req: any }) => {
  return canAccessPayloadAdmin(req.user as AppUserLike | undefined)
}

export const agenciesReadAccess: Access = ({ req }) => {
  const user = req.user as AppUserLike | undefined
  if (!user) return false
  if (isPlatformAdmin(user)) return true
  const agencyId = getId(user.agency)
  return agencyId ? { id: { equals: agencyId } } : false
}

export const customersReadAccess: Access = async ({ req }) => {
  const user = req.user as AppUserLike | undefined
  if (!user) return false
  if (isPlatformAdmin(user)) return true

  if (isCustomerAdmin(user) || user.role === 'customer-user') {
    const customerId = getId(user.customer)
    return customerId ? { id: { equals: customerId } } : false
  }

  const agencyId = getId(user.agency)
  if (!agencyId) return false

  if (hasAutomaticAgencyWideCustomerAccess(user)) {
    return { agency: { equals: agencyId } }
  }

  const assignedCustomerIds = await getAssignedCustomerIds(req)
  if (assignedCustomerIds.length === 0) {
    return { id: { equals: '__none__' } }
  }

  return {
    and: [
      { agency: { equals: agencyId } },
      { id: { in: assignedCustomerIds } },
    ],
  } satisfies Where
}

export const usersReadAccess: Access = async ({ req }) => {
  const user = req.user as AppUserLike | undefined
  if (!user) return false
  if (isPlatformAdmin(user)) return true

  if (isCustomerAdmin(user)) {
    const customerId = getId(user.customer)
    if (!customerId) {
      return { id: { equals: getId(user.id) } }
    }
    return {
      or: [
        { id: { equals: getId(user.id) } },
        { customer: { equals: customerId } },
      ],
    }
  }

  if (user.role === 'customer-user') {
    return { id: { equals: getId(user.id) } }
  }

  const agencyId = getId(user.agency)
  if (!agencyId) return false

  if (isAgencyAdmin(user) || isAgencyManager(user)) {
    return { agency: { equals: agencyId } }
  }

  const assignedCustomerIds = await getAssignedCustomerIds(req)
  if (assignedCustomerIds.length === 0) {
    return { id: { equals: getId(user.id) } }
  }
  return {
    and: [
      { agency: { equals: agencyId } },
      {
        or: [
          { id: { equals: getId(user.id) } },
          { customer: { in: assignedCustomerIds } },
        ],
      },
    ],
  }
}

export const auditLogReadAccess: Access = ({ req }) => {
  const user = req.user as AppUserLike | undefined
  if (!user) return false
  if (isPlatformAdmin(user)) return true
  if (isAgencyAdmin(user) || isAgencyManager(user)) {
    const agencyId = getId(user.agency)
    return agencyId ? { agency: { equals: agencyId } } : false
  }
  return false
}
