import { APIError } from 'payload'
import { assertLastAgencyAdminProtection, assertLastCustomerAdminProtection, assertNoAgencyTransfer, validateUserShape } from '@/lib/rules'
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
