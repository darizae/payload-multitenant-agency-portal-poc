import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { canAccessAdminPanel, customersReadAccess } from '@/lib/access'
import { isPlatformAdmin, isAgencyAdmin } from '@/lib/permissions'
import { getId } from '@/lib/utils'
import { writeAuditLog } from '@/lib/audit'

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
      const agencyId = getId(user?.agency)
      if (!agencyId) return false
      return { agency: { equals: agencyId } }
    },
    create: ({ req }) => isPlatformAdmin(req.user as any) || isAgencyAdmin(req.user as any),
    update: ({ req }) => isPlatformAdmin(req.user as any) || isAgencyAdmin(req.user as any),
    delete: ({ req }) => isPlatformAdmin(req.user as any) || isAgencyAdmin(req.user as any),
  },
  hooks: {
    beforeValidate: [
      async ({ data, req }) => {
        if (!data) return data
        const agencyUserId = getId(data.agencyUser)
        const customerId = getId(data.customer)
        const agencyId = getId(data.agency)

        if (!agencyUserId || !customerId || !agencyId) return data

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

        if (existing.totalDocs > 0 && (!data.id || String(existing.docs[0].id) !== String(data.id))) {
          throw new APIError('This agency user is already actively assigned to that customer.', 400)
        }

        data.assignmentLabel = `${agencyUser.name || agencyUser.email} → ${customer.name}`
        data.assignedAt = data.assignedAt || new Date().toISOString()
        return data
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
