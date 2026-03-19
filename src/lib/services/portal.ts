import { getPayloadClient } from '@/lib/payload'
import { canAccessAgencyWorkspace, canManageCustomerUsers, canUserSeeCustomer } from '@/lib/rules'
import { hasAutomaticAgencyWideCustomerAccess, isAgencyAdmin, isAgencyManager, isPlatformAdmin } from '@/lib/permissions'
import type { AppUserLike } from '@/lib/types'
import { getId } from '@/lib/utils'

export async function getAssignedCustomerIdsForUser(user?: AppUserLike | null): Promise<Array<string | number>> {
  const payload = await getPayloadClient()
  const userId = getId(user?.id)
  if (!userId) return []

  const result = await payload.find({
    collection: 'agency-customer-assignments',
    overrideAccess: true,
    depth: 0,
    limit: 200,
    where: {
      and: [
        { agencyUser: { equals: userId } },
        { status: { equals: 'active' } },
      ],
    },
  })

  return result.docs.map((doc: any) => doc.customer).filter(Boolean)
}

export async function getVisibleAgencies(user: AppUserLike) {
  const payload = await getPayloadClient()
  if (isPlatformAdmin(user)) {
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

export async function getVisibleCustomers(user: AppUserLike) {
  const payload = await getPayloadClient()
  if (isPlatformAdmin(user)) {
    return payload.find({ collection: 'customers', overrideAccess: true, depth: 1, limit: 200, sort: 'name' })
  }

  const agencyId = getId(user.agency)
  if (!agencyId) return { docs: [], totalDocs: 0 }

  if (user.role === 'customer-admin' || user.role === 'customer-user') {
    const customerId = getId(user.customer)
    if (!customerId) return { docs: [], totalDocs: 0 }
    return payload.find({
      collection: 'customers',
      overrideAccess: true,
      depth: 1,
      limit: 1,
      where: { id: { equals: customerId } },
    })
  }

  if (hasAutomaticAgencyWideCustomerAccess(user)) {
    return payload.find({
      collection: 'customers',
      overrideAccess: true,
      depth: 1,
      limit: 200,
      sort: 'name',
      where: { agency: { equals: agencyId } },
    })
  }

  const assignedCustomerIds = await getAssignedCustomerIdsForUser(user)
  if (assignedCustomerIds.length === 0) return { docs: [], totalDocs: 0 }
  return payload.find({
    collection: 'customers',
    overrideAccess: true,
    depth: 1,
    limit: 200,
    sort: 'name',
    where: {
      and: [
        { agency: { equals: agencyId } },
        { id: { in: assignedCustomerIds } },
      ],
    },
  })
}

export async function getAgencyPageData(user: AppUserLike, agencyId: string | number) {
  const payload = await getPayloadClient()
  if (!canAccessAgencyWorkspace(user)) {
    return null
  }

  if (!isPlatformAdmin(user) && String(getId(user.agency)) !== String(agencyId)) {
    return null
  }

  const agencyResult = await payload.find({
    collection: 'agencies',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { id: { equals: agencyId } },
  })
  const agency = agencyResult.docs[0]
  if (!agency) {
    return null
  }

  const [customers, users, assignments, invites] = await Promise.all([
    payload.find({ collection: 'customers', overrideAccess: true, depth: 1, limit: 200, sort: 'name', where: { agency: { equals: agencyId } } }),
    payload.find({ collection: 'users', overrideAccess: true, depth: 1, limit: 200, sort: 'name', where: { agency: { equals: agencyId } } }),
    payload.find({ collection: 'agency-customer-assignments', overrideAccess: true, depth: 1, limit: 200, where: { agency: { equals: agencyId } } }),
    isPlatformAdmin(user) || isAgencyAdmin(user)
      ? payload.find({ collection: 'invite-tokens', overrideAccess: true, depth: 1, limit: 200, sort: '-createdAt', where: { agency: { equals: agencyId } } })
      : Promise.resolve({ docs: [] }),
  ])

  return { agency, customers: customers.docs, users: users.docs, assignments: assignments.docs, invites: invites.docs }
}

export async function getCustomerPageData(user: AppUserLike, customerId: string | number) {
  const payload = await getPayloadClient()
  const assignedCustomerIds = await getAssignedCustomerIdsForUser(user)
  const customerResult = await payload.find({
    collection: 'customers',
    overrideAccess: true,
    depth: 1,
    limit: 1,
    where: { id: { equals: customerId } },
  })
  const customer = customerResult.docs[0]
  if (!customer) {
    return null
  }

  if (!canUserSeeCustomer({ user, customer, assignedCustomerIds })) {
    return null
  }

  const canManageUsers = canManageCustomerUsers({ user, customer, assignedCustomerIds })
  const canAssignAgencyUsers = isPlatformAdmin(user) || isAgencyAdmin(user)

  const [customerUsers, assignments, invites, agencyUsers] = await Promise.all([
    payload.find({ collection: 'users', overrideAccess: true, depth: 1, limit: 200, where: { customer: { equals: customerId } }, sort: 'name' }),
    payload.find({ collection: 'agency-customer-assignments', overrideAccess: true, depth: 1, limit: 200, where: { customer: { equals: customerId } } }),
    canManageUsers
      ? payload.find({ collection: 'invite-tokens', overrideAccess: true, depth: 1, limit: 200, where: { customer: { equals: customerId } }, sort: '-createdAt' })
      : Promise.resolve({ docs: [] }),
    canAssignAgencyUsers
      ? payload.find({
        collection: 'users',
        overrideAccess: true,
        depth: 0,
        limit: 200,
        where: {
          and: [
            { agency: { equals: getId(customer.agency) } },
            { role: { in: ['agency-admin', 'agency-manager', 'agency-user'] } },
          ],
        },
        sort: 'name',
      })
      : Promise.resolve({ docs: [] }),
  ])

  return {
    customer,
    customerUsers: customerUsers.docs,
    assignments: assignments.docs,
    agencyUsers: agencyUsers.docs,
    invites: invites.docs,
  }
}

export async function getDashboardStats(user: AppUserLike) {
  const agencies = await getVisibleAgencies(user)
  const customers = await getVisibleCustomers(user)
  const payload = await getPayloadClient()

  let userCount = 0
  if (isPlatformAdmin(user)) {
    userCount = (await payload.count({ collection: 'users', overrideAccess: true, where: {} })).totalDocs
  } else if (user.role === 'customer-admin' || user.role === 'customer-user') {
    const customerId = getId(user.customer)
    userCount = customerId
      ? (await payload.count({ collection: 'users', overrideAccess: true, where: { customer: { equals: customerId } } })).totalDocs
      : 0
  } else if (isAgencyAdmin(user) || isAgencyManager(user) || hasAutomaticAgencyWideCustomerAccess(user)) {
    const agencyId = getId(user.agency)
    userCount = agencyId
      ? (await payload.count({ collection: 'users', overrideAccess: true, where: { agency: { equals: agencyId } } })).totalDocs
      : 0
  } else {
    const agencyId = getId(user.agency)
    const userId = getId(user.id)
    const assignedCustomerIds = await getAssignedCustomerIdsForUser(user)
    if (!userId) {
      userCount = 0
    } else if (!agencyId || assignedCustomerIds.length === 0) {
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
                { customer: { in: assignedCustomerIds } },
              ],
            },
          ],
        },
      })).totalDocs
    }
  }

  return {
    agencies: agencies.totalDocs,
    customers: customers.totalDocs,
    users: userCount,
  }
}
