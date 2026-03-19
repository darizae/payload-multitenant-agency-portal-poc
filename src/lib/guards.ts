import { APIError } from 'payload'
import { assertLastAgencyAdminProtection, assertLastCustomerAdminProtection, assertNoAgencyTransfer, validateUserShape } from '@/lib/rules'
import { isAgencyAdmin, isAgencyManager, isCustomerAdmin, isPlatformAdmin } from '@/lib/permissions'
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
  const customerId = getId(draft.customer)

  if (customerId) {
    const customer = await payload.findByID({
      collection: 'customers',
      id: customerId,
      depth: 0,
      overrideAccess: true,
    })

    const customerAgencyId = getId(customer?.agency)
    if (!customerAgencyId || (agencyId && String(customerAgencyId) != String(agencyId))) {
      throw new APIError('Customer users must reference the same parent agency as their customer.', 400)
    }

    draft.agency = customerAgencyId
  }

  if (originalDoc?.id && originalDoc.role === 'agency-admin' && originalDoc.agency) {
    const count = await payload.count({
      collection: 'users',
      overrideAccess: true,
      where: {
        and: [
          { agency: { equals: getId(originalDoc.agency) } },
          { role: { equals: 'agency-admin' } },
          { status: { equals: 'active' } },
        ],
      },
    })

    const error = assertLastAgencyAdminProtection({
      activeAgencyAdminCount: count.totalDocs,
      originalRole: originalDoc.role,
      nextRole: draft.role,
      originalStatus: originalDoc.status,
      nextStatus: draft.status,
    })

    if (error) throw new APIError(error, 400)
  }

  if (originalDoc?.id && originalDoc.role === 'customer-admin' && originalDoc.customer) {
    const count = await payload.count({
      collection: 'users',
      overrideAccess: true,
      where: {
        and: [
          { customer: { equals: getId(originalDoc.customer) } },
          { role: { equals: 'customer-admin' } },
          { status: { equals: 'active' } },
        ],
      },
    })

    const error = assertLastCustomerAdminProtection({
      activeCustomerAdminCount: count.totalDocs,
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
  if (isPlatformAdmin(actor)) return

  const draft = {
    ...originalDoc,
    ...nextData,
  }
  const actorId = getId(actor.id)
  const actorAgencyId = getId(actor.agency)
  const actorCustomerId = getId(actor.customer)
  const draftAgencyId = getId(draft.agency)
  const draftCustomerId = getId(draft.customer)

  if (isAgencyAdmin(actor)) {
    if (!actorAgencyId || !draftAgencyId || String(actorAgencyId) !== String(draftAgencyId)) {
      throw new APIError('Agency admins can only manage users in their own agency.', 403)
    }
    if (draft.role === 'platform-admin' || originalDoc?.role === 'platform-admin') {
      throw new APIError('Agency admins cannot create or edit platform admins.', 403)
    }
    return
  }

  if (isCustomerAdmin(actor)) {
    if (operation === 'create' && !draftCustomerId) {
      throw new APIError('Customer admins can only create users for their own customer.', 403)
    }
    if (!actorCustomerId || !draftCustomerId || String(actorCustomerId) !== String(draftCustomerId)) {
      throw new APIError('Customer admins can only manage users in their own customer.', 403)
    }
    if (actorAgencyId && draftAgencyId && String(actorAgencyId) !== String(draftAgencyId)) {
      throw new APIError('Customer admins can only manage users in their own agency.', 403)
    }
    if (!['customer-admin', 'customer-user'].includes(String(draft.role || ''))) {
      throw new APIError('Customer admins can only manage customer roles.', 403)
    }
    return
  }

  if ((isAgencyManager(actor) || actor.role === 'agency-user') && operation === 'create') {
    if (!actorAgencyId || !draftAgencyId || String(actorAgencyId) !== String(draftAgencyId)) {
      throw new APIError('Agency users can only create customer users in their own agency.', 403)
    }
    if (!draftCustomerId) {
      throw new APIError('Customer users must be created inside a customer workspace.', 403)
    }
    if (!['customer-admin', 'customer-user'].includes(String(draft.role || ''))) {
      throw new APIError('Agency users can only create customer user roles.', 403)
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
  if (isPlatformAdmin(actor)) return

  const actorAgencyId = getId(actor.agency)
  const targetAgencyId = getId(targetDoc.agency)
  const actorCustomerId = getId(actor.customer)
  const targetCustomerId = getId(targetDoc.customer)

  if (isAgencyAdmin(actor)) {
    if (!actorAgencyId || !targetAgencyId || String(actorAgencyId) !== String(targetAgencyId) || targetDoc.role === 'platform-admin') {
      throw new APIError('Agency admins can only delete users in their own agency.', 403)
    }
    return
  }

  if (isCustomerAdmin(actor)) {
    if (!actorCustomerId || !targetCustomerId || String(actorCustomerId) !== String(targetCustomerId)) {
      throw new APIError('Customer admins can only delete users in their own customer.', 403)
    }
    if (!['customer-admin', 'customer-user'].includes(String(targetDoc.role || ''))) {
      throw new APIError('Customer admins can only delete customer users.', 403)
    }
    return
  }

  throw new APIError('You do not have permission to delete this user.', 403)
}

export async function validateCustomerBusinessRules(args: {
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

export function validateCustomerWritePermissions(args: {
  actor?: AppUserLike | null
  originalDoc?: any
  nextData: Record<string, any>
  operation: 'create' | 'update'
}) {
  const { actor, originalDoc, nextData, operation } = args
  if (!actor) return
  if (isPlatformAdmin(actor)) return

  const actorAgencyId = getId(actor.agency)
  const nextAgencyId = getId(nextData?.agency ?? originalDoc?.agency)
  const originalCustomerId = getId(originalDoc?.id)
  const actorCustomerId = getId(actor.customer)

  if (isAgencyAdmin(actor) || isAgencyManager(actor)) {
    if (!actorAgencyId || !nextAgencyId || String(actorAgencyId) !== String(nextAgencyId)) {
      throw new APIError('Agency users can only manage customers in their own agency.', 403)
    }
    return
  }

  if (isCustomerAdmin(actor)) {
    if (operation === 'create') {
      throw new APIError('Customer admins cannot create customers.', 403)
    }
    if (!actorCustomerId || !originalCustomerId || String(actorCustomerId) !== String(originalCustomerId)) {
      throw new APIError('Customer admins can only update their own customer.', 403)
    }
    if (actorAgencyId && nextAgencyId && String(actorAgencyId) !== String(nextAgencyId)) {
      throw new APIError('Customer admins cannot move customers across agencies.', 403)
    }
    return
  }

  throw new APIError('You do not have permission to manage customers.', 403)
}

export function validateCustomerDeletePermissions(args: {
  actor?: AppUserLike | null
  targetDoc?: any
}) {
  const { actor, targetDoc } = args
  if (!actor || !targetDoc) return
  if (isPlatformAdmin(actor)) return

  if (isAgencyAdmin(actor) && String(getId(actor.agency)) === String(getId(targetDoc.agency))) {
    return
  }

  throw new APIError('You do not have permission to delete this customer.', 403)
}

export function validateAssignmentWritePermissions(args: {
  actor?: AppUserLike | null
  assignmentAgency?: unknown
}) {
  const { actor, assignmentAgency } = args
  if (!actor) return
  if (isPlatformAdmin(actor)) return

  if (isAgencyAdmin(actor) && String(getId(actor.agency)) === String(getId(assignmentAgency))) {
    return
  }

  throw new APIError('You do not have permission to manage assignments in this agency.', 403)
}
