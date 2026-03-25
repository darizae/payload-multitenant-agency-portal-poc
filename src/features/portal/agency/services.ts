import { getPayloadClient } from '@/lib/payload'
import { canAccessAgencyWorkspace } from '@/authz/ui-rules'
import { isAgencyRoot, isStoreheroRole } from '@/authz/roles'
import type { AppUserLike } from '@/lib/types'
import { getId } from '@/lib/utils'

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
