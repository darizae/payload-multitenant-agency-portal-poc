import { APIError } from 'payload'
import { assertLastAgencyRootProtection, assertLastStoreRootProtection, assertNoAgencyTransfer, validateUserShape } from '@/lib/rules'
import { hasAutomaticAgencyWideStoreAccess, isAgencyMember, isAgencyRoot, isStoreMember, isStoreRoot, isStoreheroMember, isStoreheroRoot, isStoreheroRole } from '@/lib/permissions'
import type { AppUserLike } from '@/lib/types'
import { getId } from '@/lib/utils'

export async function validateUserBusinessRules(args: {
  payload: any
  originalDoc?: any
  nextData: Record<string, any>
}) {
  const { payload, originalDoc, nextData } = args
  const draft = {
    ...originalDoc,
    ...nextData,
  }

  const shapeErrors = validateUserShape(draft)
  if (shapeErrors.length > 0) {
    throw new APIError(shapeErrors.join(' '), 400)
  }

  const agencyId = getId(draft.agency)
  const storeId = getId(draft.store)

  if (storeId) {
    const store = await payload.findByID({
      collection: 'stores',
      id: storeId,
      depth: 0,
      overrideAccess: true,
    })

    const storeAgencyId = getId(store?.agency)
    if (!storeAgencyId || (agencyId && String(storeAgencyId) !== String(agencyId))) {
      throw new APIError('Store users must reference the same parent agency as their store.', 400)
    }

    draft.agency = storeAgencyId
  }

  if (originalDoc?.id && originalDoc.role === 'agency-root' && originalDoc.agency) {
    const count = await payload.count({
      collection: 'users',
      overrideAccess: true,
      where: {
        and: [
          { agency: { equals: getId(originalDoc.agency) } },
          { role: { equals: 'agency-root' } },
          { status: { equals: 'active' } },
        ],
      },
    })

    const error = assertLastAgencyRootProtection({
      activeAgencyRootCount: count.totalDocs,
      originalRole: originalDoc.role,
      nextRole: draft.role,
      originalStatus: originalDoc.status,
      nextStatus: draft.status,
    })

    if (error) throw new APIError(error, 400)
  }

  if (originalDoc?.id && originalDoc.role === 'store-root' && originalDoc.store) {
    const count = await payload.count({
      collection: 'users',
      overrideAccess: true,
      where: {
        and: [
          { store: { equals: getId(originalDoc.store) } },
          { role: { equals: 'store-root' } },
          { status: { equals: 'active' } },
        ],
      },
    })

    const error = assertLastStoreRootProtection({
      activeStoreRootCount: count.totalDocs,
      originalRole: originalDoc.role,
      nextRole: draft.role,
      originalStatus: originalDoc.status,
      nextStatus: draft.status,
    })

    if (error) throw new APIError(error, 400)
  }

  return draft
}

export function validateUserWritePermissions(args: {
  actor?: AppUserLike | null
  originalDoc?: any
  nextData: Record<string, any>
  operation: 'create' | 'update'
}) {
  const { actor, originalDoc, nextData, operation } = args
  if (!actor) return
  if (isStoreheroRoot(actor)) return

  const draft = {
    ...originalDoc,
    ...nextData,
  }

  const actorId = getId(actor.id)
  const actorAgencyId = getId(actor.agency)
  const actorStoreId = getId(actor.store)
  const draftAgencyId = getId(draft.agency)
  const draftStoreId = getId(draft.store)
  const draftRole = String(draft.role || '')
  const originalRole = String(originalDoc?.role || '')

  if (isStoreheroMember(actor)) {
    if (draftRole.startsWith('storehero-') || originalRole.startsWith('storehero-')) {
      throw new APIError('Storehero members cannot manage Storehero root/member accounts.', 403)
    }
    return
  }

  if (isAgencyRoot(actor)) {
    if (!actorAgencyId || !draftAgencyId || String(actorAgencyId) !== String(draftAgencyId)) {
      throw new APIError('Agency root users can only manage users in their own agency.', 403)
    }
    if (draftRole.startsWith('storehero-') || originalRole.startsWith('storehero-')) {
      throw new APIError('Agency root users cannot create or edit Storehero accounts.', 403)
    }
    return
  }

  if (isStoreRoot(actor)) {
    if (operation === 'create' && !draftStoreId) {
      throw new APIError('Store root users can only create users for their own store.', 403)
    }
    if (!actorStoreId || !draftStoreId || String(actorStoreId) !== String(draftStoreId)) {
      throw new APIError('Store root users can only manage users in their own store.', 403)
    }
    if (actorAgencyId && draftAgencyId && String(actorAgencyId) !== String(draftAgencyId)) {
      throw new APIError('Store root users can only manage users in their own agency.', 403)
    }
    if (!['store-root', 'store-member'].includes(draftRole)) {
      throw new APIError('Store root users can only manage store roles.', 403)
    }
    return
  }

  if ((isAgencyMember(actor) || actor.role === 'store-member') && operation === 'create') {
    if (actor.role === 'store-member') {
      throw new APIError('Store members cannot create users.', 403)
    }
    if (!actorAgencyId || !draftAgencyId || String(actorAgencyId) !== String(draftAgencyId)) {
      throw new APIError('Agency members can only create store users in their own agency.', 403)
    }
    if (!draftStoreId) {
      throw new APIError('Store users must be created inside a store workspace.', 403)
    }
    if (!['store-root', 'store-member'].includes(draftRole)) {
      throw new APIError('Agency members can only create store user roles.', 403)
    }
    return
  }

  if (operation === 'create') {
    throw new APIError('You do not have permission to create users.', 403)
  }

  if (!actorId || String(actorId) !== String(getId(originalDoc?.id))) {
    throw new APIError('You do not have permission to update this user.', 403)
  }

  const allowedSelfUpdateFields = ['name', 'lastLoginAt']
  const forbiddenKeys = Object.keys(nextData || {}).filter((key) => !allowedSelfUpdateFields.includes(key))
  if (forbiddenKeys.length > 0) {
    throw new APIError('You can only update your own profile name.', 403)
  }
}

export function validateUserDeletePermissions(args: {
  actor?: AppUserLike | null
  targetDoc?: any
}) {
  const { actor, targetDoc } = args
  if (!actor || !targetDoc) return
  if (isStoreheroRoot(actor)) return

  const actorAgencyId = getId(actor.agency)
  const targetAgencyId = getId(targetDoc.agency)
  const actorStoreId = getId(actor.store)
  const targetStoreId = getId(targetDoc.store)
  const targetRole = String(targetDoc.role || '')

  if (isStoreheroMember(actor)) {
    if (targetRole.startsWith('storehero-')) {
      throw new APIError('Storehero members cannot delete Storehero root/member accounts.', 403)
    }
    return
  }

  if (isAgencyRoot(actor)) {
    if (!actorAgencyId || !targetAgencyId || String(actorAgencyId) !== String(targetAgencyId) || targetRole.startsWith('storehero-')) {
      throw new APIError('Agency root users can only delete users in their own agency.', 403)
    }
    return
  }

  if (isStoreRoot(actor)) {
    if (!actorStoreId || !targetStoreId || String(actorStoreId) !== String(targetStoreId)) {
      throw new APIError('Store root users can only delete users in their own store.', 403)
    }
    if (!['store-root', 'store-member'].includes(targetRole)) {
      throw new APIError('Store root users can only delete store users.', 403)
    }
    return
  }

  throw new APIError('You do not have permission to delete this user.', 403)
}

export async function validateStoreBusinessRules(args: {
  originalDoc?: any
  nextData: Record<string, any>
}) {
  const { originalDoc, nextData } = args

  const error = assertNoAgencyTransfer({
    originalAgencyId: getId(originalDoc?.agency),
    nextAgencyId: getId(nextData?.agency ?? originalDoc?.agency),
  })

  if (error) {
    throw new APIError(error, 400)
  }
}

export function validateStoreWritePermissions(args: {
  actor?: AppUserLike | null
  originalDoc?: any
  nextData: Record<string, any>
  operation: 'create' | 'update'
}) {
  const { actor, originalDoc, nextData, operation } = args
  if (!actor) return
  if (isStoreheroRole(actor)) return

  const actorAgencyId = getId(actor.agency)
  const nextAgencyId = getId(nextData?.agency ?? originalDoc?.agency)
  const originalStoreId = getId(originalDoc?.id)
  const actorStoreId = getId(actor.store)

  if (isAgencyRoot(actor) || isAgencyMember(actor)) {
    if (!actorAgencyId || !nextAgencyId || String(actorAgencyId) !== String(nextAgencyId)) {
      throw new APIError('Agency users can only manage stores in their own agency.', 403)
    }
    return
  }

  if (isStoreRoot(actor)) {
    if (operation === 'create') {
      throw new APIError('Store root users cannot create stores.', 403)
    }
    if (!actorStoreId || !originalStoreId || String(actorStoreId) !== String(originalStoreId)) {
      throw new APIError('Store root users can only update their own store.', 403)
    }
    if (actorAgencyId && nextAgencyId && String(actorAgencyId) !== String(nextAgencyId)) {
      throw new APIError('Store root users cannot move stores across agencies.', 403)
    }
    return
  }

  throw new APIError('You do not have permission to manage stores.', 403)
}

export function validateStoreDeletePermissions(args: {
  actor?: AppUserLike | null
  targetDoc?: any
}) {
  const { actor, targetDoc } = args
  if (!actor || !targetDoc) return
  if (isStoreheroRole(actor)) return

  if (isAgencyRoot(actor) && String(getId(actor.agency)) === String(getId(targetDoc.agency))) {
    return
  }

  throw new APIError('You do not have permission to delete this store.', 403)
}

export function validateAssignmentWritePermissions(args: {
  actor?: AppUserLike | null
  assignmentAgency?: unknown
}) {
  const { actor, assignmentAgency } = args
  if (!actor) return
  if (isStoreheroRole(actor)) return

  if (isAgencyRoot(actor) && String(getId(actor.agency)) === String(getId(assignmentAgency))) {
    return
  }

  throw new APIError('You do not have permission to manage assignments in this agency.', 403)
}

export async function validateMetricWritePermissions(args: {
  payload: any
  actor?: AppUserLike | null
  originalDoc?: any
  nextData?: Record<string, any>
}) {
  const { payload, actor, originalDoc, nextData } = args
  if (!actor) return
  if (isStoreheroRole(actor)) return

  const tenantId = getId(nextData?.tenant ?? originalDoc?.tenant)
  const storeId = getId(nextData?.store ?? originalDoc?.store)
  if (!tenantId || !storeId) {
    throw new APIError('Metrics must include tenant and store.', 400)
  }

  const store = await payload.findByID({
    collection: 'stores',
    id: storeId,
    depth: 0,
    overrideAccess: true,
  })
  if (!store) {
    throw new APIError('Store was not found.', 404)
  }

  const storeAgencyId = getId(store.agency)
  if (!storeAgencyId || String(storeAgencyId) !== String(tenantId)) {
    throw new APIError('Metric tenant must match the store agency.', 400)
  }

  const actorAgencyId = getId(actor.agency)
  const actorStoreId = getId(actor.store)

  if (isAgencyRoot(actor)) {
    if (!actorAgencyId || String(actorAgencyId) !== String(tenantId)) {
      throw new APIError('Agency root users can only write metrics in their own agency.', 403)
    }
    return
  }

  if (isAgencyMember(actor)) {
    if (!actorAgencyId || String(actorAgencyId) !== String(tenantId)) {
      throw new APIError('Agency members can only write metrics in their own agency.', 403)
    }

    if (hasAutomaticAgencyWideStoreAccess(actor)) {
      return
    }

    const actorId = getId(actor.id)
    if (!actorId) {
      throw new APIError('Agency members require an active user identity to write metrics.', 403)
    }

    const assignmentCount = await payload.count({
      collection: 'agency-store-assignments',
      overrideAccess: true,
      where: {
        and: [
          { agency: { equals: tenantId } },
          { store: { equals: storeId } },
          { agencyUser: { equals: actorId } },
          { status: { equals: 'active' } },
        ],
      },
    })

    if (assignmentCount.totalDocs < 1) {
      throw new APIError('Agency members can only write metrics for assigned stores.', 403)
    }
    return
  }

  if (isStoreRoot(actor) || isStoreMember(actor)) {
    if (!actorStoreId || String(actorStoreId) !== String(storeId)) {
      throw new APIError('Store users can only write metrics in their own store.', 403)
    }
    if (actorAgencyId && String(actorAgencyId) !== String(tenantId)) {
      throw new APIError('Store users can only write metrics in their own agency.', 403)
    }
    return
  }

  throw new APIError('You do not have permission to write metrics.', 403)
}
