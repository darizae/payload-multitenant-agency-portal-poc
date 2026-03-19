import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { canAccessAdminPanel } from '@/lib/access'
import { isPlatformAdmin, isAgencyAdmin, isAgencyManager } from '@/lib/permissions'
import { validateAssignmentWritePermissions } from '@/lib/guards'
import { getId } from '@/lib/utils'
import { writeAuditLog } from '@/lib/audit'

async function getAssignedCustomerIds(req: any, userId: string | number): Promise<Array<string | number>> {
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

export const AgencyCustomerAssignments: CollectionConfig = {
  slug: 'agency-customer-assignments',
  admin: {
    useAsTitle: 'assignmentLabel',
    defaultColumns: ['agencyUser', 'customer', 'status', 'assignedAt'],
  },
  access: {
    admin: canAccessAdminPanel,
    read: async ({ req }) => {
      const user = req.user as any
      if (!user) return false
      if (isPlatformAdmin(user)) return true
      const role = String(user?.role || '')
      const agencyId = getId(user?.agency)
      if (!agencyId) return false
      if (isAgencyAdmin(user) || isAgencyManager(user)) {
        return { agency: { equals: agencyId } }
      }
      if (role === 'customer-admin' || role === 'customer-user') {
        const customerId = getId(user?.customer)
        return customerId ? { customer: { equals: customerId } } : false
      }
      const userId = getId(user?.id)
      if (!userId) return false
      const assignedCustomerIds = await getAssignedCustomerIds(req, userId)
      if (assignedCustomerIds.length === 0) {
        return {
          and: [
            { agency: { equals: agencyId } },
            { agencyUser: { equals: userId } },
          ],
        }
      }
      return {
        and: [
          { agency: { equals: agencyId } },
          {
            or: [
              { agencyUser: { equals: userId } },
              { customer: { in: assignedCustomerIds } },
            ],
          },
        ],
      }
    },
    create: ({ req }) => isPlatformAdmin(req.user as any) || isAgencyAdmin(req.user as any),
    update: ({ req }) => {
      const user = req.user as any
      if (isPlatformAdmin(user)) return true
      if (isAgencyAdmin(user)) {
        const agencyId = getId(user?.agency)
        return agencyId ? { agency: { equals: agencyId } } : false
      }
      return false
    },
    delete: ({ req }) => {
      const user = req.user as any
      if (isPlatformAdmin(user)) return true
      if (isAgencyAdmin(user)) {
        const agencyId = getId(user?.agency)
        return agencyId ? { agency: { equals: agencyId } } : false
      }
      return false
    },
  },
  hooks: {
    beforeValidate: [
      async ({ data, req, originalDoc }) => {
        if (!data && !originalDoc) return data
        const draft = {
          ...originalDoc,
          ...(data || {}),
        }
        const agencyUserId = getId(draft.agencyUser)
        const customerId = getId(draft.customer)
        const agencyId = getId(draft.agency)

        if (!agencyUserId || !customerId || !agencyId) return data
        validateAssignmentWritePermissions({
          actor: req.user as any,
          assignmentAgency: agencyId,
        })

        const [agencyUser, customer] = await Promise.all([
          req.payload.findByID({ collection: 'users', id: agencyUserId, overrideAccess: true, depth: 0 }),
          req.payload.findByID({ collection: 'customers', id: customerId, overrideAccess: true, depth: 0 }),
        ])

        if (!agencyUser || !customer) throw new APIError('Assignment references are invalid.', 400)

        if (agencyUser.role === 'customer-admin' || agencyUser.role === 'customer-user') {
          throw new APIError('Only agency-side users can be assigned to customers.', 400)
        }

        if (String(getId(agencyUser.agency)) !== String(agencyId) || String(getId(customer.agency)) !== String(agencyId)) {
          throw new APIError('Assignment agency, agency user, and customer must all belong to the same agency.', 400)
        }

        if (draft.status === 'active') {
          const existing = await req.payload.find({
            collection: 'agency-customer-assignments',
            depth: 0,
            limit: 1,
            overrideAccess: true,
            where: {
              and: [
                { agencyUser: { equals: agencyUserId } },
                { customer: { equals: customerId } },
                { status: { equals: 'active' } },
              ],
            },
          })

          const currentId = getId(originalDoc?.id)
          if (existing.totalDocs > 0 && String(existing.docs[0].id) !== String(currentId)) {
            throw new APIError('This agency user is already actively assigned to that customer.', 400)
          }
        }

        const nextData = data || {}
        nextData.assignmentLabel = `${agencyUser.name || agencyUser.email} → ${customer.name}`
        nextData.assignedAt = draft.assignedAt || new Date().toISOString()
        return nextData
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        await writeAuditLog({
          payload: req.payload,
          actor: req.user as any,
          action: `assignment.${operation}`,
          entityType: 'assignment',
          entityId: doc.id,
          agency: getId(doc.agency),
          customer: getId(doc.customer),
          summary: `${operation === 'create' ? 'Created' : 'Updated'} assignment ${doc.assignmentLabel}`,
        })
        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        await writeAuditLog({
          payload: req.payload,
          actor: req.user as any,
          action: 'assignment.delete',
          entityType: 'assignment',
          entityId: doc.id,
          agency: getId(doc.agency),
          customer: getId(doc.customer),
          summary: `Deleted assignment ${doc.assignmentLabel}`,
        })
      },
    ],
  },
  fields: [
    {
      name: 'assignmentLabel',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'agency',
      type: 'relationship',
      relationTo: 'agencies',
      required: true,
    },
    {
      name: 'agencyUser',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
    },
    {
      name: 'assignedAt',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'assignedBy',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      required: true,
      options: ['active', 'inactive'],
    },
  ],
}
