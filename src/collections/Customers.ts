import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { customersReadAccess, canAccessAdminPanel } from '@/lib/access'
import { isPlatformAdmin, isAgencyAdmin, isAgencyManager } from '@/lib/permissions'
import { getId } from '@/lib/utils'
import { validateCustomerBusinessRules, validateCustomerDeletePermissions, validateCustomerWritePermissions } from '@/lib/guards'
import { writeAuditLog } from '@/lib/audit'

export const Customers: CollectionConfig = {
  slug: 'customers',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'agency', 'status', 'updatedAt'],
  },
  access: {
    admin: canAccessAdminPanel,
    read: customersReadAccess,
    create: ({ req }) => {
      const user = req.user as any
      return isPlatformAdmin(user) || isAgencyAdmin(user) || isAgencyManager(user)
    },
    update: ({ req }) => {
      const user = req.user as any
      if (isPlatformAdmin(user)) return true
      if (isAgencyAdmin(user) || isAgencyManager(user)) {
        const agencyId = getId(user?.agency)
        return agencyId ? { agency: { equals: agencyId } } : false
      }
      if (user?.role === 'customer-admin') {
        const customerId = getId(user?.customer)
        return customerId ? { id: { equals: customerId } } : false
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
    beforeChange: [
      async ({ data, originalDoc, req, operation }) => {
        validateCustomerWritePermissions({
          actor: req.user as any,
          originalDoc,
          nextData: data || {},
          operation,
        })
        await validateCustomerBusinessRules({ originalDoc, nextData: data || {} })
        return data
      },
    ],
    beforeDelete: [
      async ({ req, id }) => {
        const customer = await req.payload.findByID({ collection: 'customers', id, overrideAccess: true, depth: 0 })
        validateCustomerDeletePermissions({
          actor: req.user as any,
          targetDoc: customer,
        })

        const assignments = await req.payload.count({
          collection: 'agency-customer-assignments',
          overrideAccess: true,
          where: {
            customer: { equals: id },
          },
        })

        if (assignments.totalDocs > 0) {
          throw new APIError('Remove agency assignments before deleting a customer.', 400)
        }
      },
    ],
    afterChange: [
      async ({ doc, operation, req, previousDoc }) => {
        await writeAuditLog({
          payload: req.payload,
          actor: req.user as any,
          action: `customer.${operation}`,
          entityType: 'customer',
          entityId: doc.id,
          agency: getId(doc.agency),
          customer: doc.id,
          summary: `${operation === 'create' ? 'Created' : 'Updated'} customer ${doc.name}`,
          metadata: {
            previousStatus: previousDoc?.status,
            nextStatus: doc.status,
          },
        })
        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        await writeAuditLog({
          payload: req.payload,
          actor: req.user as any,
          action: 'customer.delete',
          entityType: 'customer',
          entityId: doc.id,
          agency: getId(doc.agency),
          customer: null,
          summary: `Deleted customer ${doc.name}`,
        })
      },
    ],
  },
  fields: [
    {
      name: 'agency',
      type: 'relationship',
      relationTo: 'agencies',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: ['active', 'inactive', 'suspended'],
    },
    {
      name: 'contactName',
      type: 'text',
    },
    {
      name: 'contactEmail',
      type: 'email',
    },
    {
      name: 'contactPhone',
      type: 'text',
    },
    {
      name: 'settings',
      type: 'json',
      defaultValue: {
        customerCanManageUsers: true,
      },
    },
  ],
}
