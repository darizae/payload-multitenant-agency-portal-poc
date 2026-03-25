import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { storesReadAccess, canAccessAdminPanel } from '@/authz/payload-access'
import { isAgencyMember, isAgencyRoot, isStoreheroRole } from '@/authz/roles'
import { getId } from '@/lib/utils'
import { validateStoreBusinessRules, validateStoreDeletePermissions, validateStoreWritePermissions } from '@/authz/policies'
import { writeAuditLog } from '@/lib/audit'

export const Stores: CollectionConfig = {
  slug: 'stores',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'agency', 'status', 'updatedAt'],
  },
  access: {
    admin: canAccessAdminPanel,
    read: storesReadAccess,
    create: ({ req }) => {
      const user = req.user as any
      return isStoreheroRole(user) || isAgencyRoot(user) || isAgencyMember(user)
    },
    update: ({ req }) => {
      const user = req.user as any
      if (isStoreheroRole(user)) return true
      if (isAgencyRoot(user) || isAgencyMember(user)) {
        const agencyId = getId(user?.agency)
        return agencyId ? { agency: { equals: agencyId } } : false
      }
      if (user?.role === 'store-root') {
        const storeId = getId(user?.store)
        return storeId ? { id: { equals: storeId } } : false
      }
      return false
    },
    delete: ({ req }) => {
      const user = req.user as any
      if (isStoreheroRole(user)) return true
      if (isAgencyRoot(user)) {
        const agencyId = getId(user?.agency)
        return agencyId ? { agency: { equals: agencyId } } : false
      }
      return false
    },
  },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req, operation }) => {
        validateStoreWritePermissions({
          actor: req.user as any,
          originalDoc,
          nextData: data || {},
          operation,
        })
        await validateStoreBusinessRules({ originalDoc, nextData: data || {} })
        return data
      },
    ],
    beforeDelete: [
      async ({ req, id }) => {
        const store = await req.payload.findByID({ collection: 'stores', id, overrideAccess: true, depth: 0 })
        validateStoreDeletePermissions({
          actor: req.user as any,
          targetDoc: store,
        })

        const [assignments, metrics] = await Promise.all([
          req.payload.count({
            collection: 'agency-store-assignments',
            overrideAccess: true,
            where: {
              store: { equals: id },
            },
          }),
          req.payload.count({
            collection: 'store-daily-metrics',
            overrideAccess: true,
            where: {
              store: { equals: id },
            },
          }),
        ])

        if (assignments.totalDocs > 0) {
          throw new APIError('Remove agency assignments before deleting a store.', 400)
        }
        if (metrics.totalDocs > 0) {
          throw new APIError('Remove metrics before deleting a store.', 400)
        }
      },
    ],
    afterChange: [
      async ({ doc, operation, req, previousDoc }) => {
        await writeAuditLog({
          payload: req.payload,
          actor: req.user as any,
          action: `store.${operation}`,
          entityType: 'store',
          entityId: doc.id,
          agency: getId(doc.agency),
          store: null,
          summary: `${operation === 'create' ? 'Created' : 'Updated'} store ${doc.name}`,
          metadata: {
            storeId: doc.id,
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
          action: 'store.delete',
          entityType: 'store',
          entityId: doc.id,
          agency: getId(doc.agency),
          store: null,
          summary: `Deleted store ${doc.name}`,
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
      name: 'internalOpsNote',
      type: 'text',
      access: {
        create: ({ req }) => {
          const user = req.user as any
          return isStoreheroRole(user) || isAgencyRoot(user)
        },
        read: ({ req }) => {
          const user = req.user as any
          return isStoreheroRole(user) || isAgencyRoot(user)
        },
        update: ({ req }) => {
          const user = req.user as any
          return isStoreheroRole(user) || isAgencyRoot(user)
        },
      },
    },
    {
      name: 'settings',
      type: 'json',
      defaultValue: {
        storeCanManageUsers: true,
      },
    },
  ],
}
