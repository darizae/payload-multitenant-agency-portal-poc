import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { agenciesReadAccess, canAccessAdminPanel } from '@/lib/access'
import { isAgencyRoot, isStoreheroRoot } from '@/lib/permissions'
import { getId } from '@/lib/utils'
import { writeAuditLog } from '@/lib/audit'

export const Agencies: CollectionConfig = {
  slug: 'agencies',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'primaryContactEmail', 'updatedAt'],
  },
  access: {
    admin: canAccessAdminPanel,
    read: agenciesReadAccess,
    create: ({ req }) => isStoreheroRoot(req.user as any),
    update: ({ req }) => {
      const user = req.user as any
      if (isStoreheroRoot(user)) return true
      const agencyId = getId(user?.agency)
      return isAgencyRoot(user) && agencyId ? { id: { equals: agencyId } } : false
    },
    delete: ({ req }) => isStoreheroRoot(req.user as any),
  },
  hooks: {
    beforeDelete: [
      async ({ req, id }) => {
        const [users, stores, assignments, invites, metrics] = await Promise.all([
          req.payload.count({ collection: 'users', overrideAccess: true, where: { agency: { equals: id } } }),
          req.payload.count({ collection: 'stores', overrideAccess: true, where: { agency: { equals: id } } }),
          req.payload.count({ collection: 'agency-store-assignments', overrideAccess: true, where: { agency: { equals: id } } }),
          req.payload.count({ collection: 'invite-tokens', overrideAccess: true, where: { agency: { equals: id } } }),
          req.payload.count({ collection: 'store-daily-metrics', overrideAccess: true, where: { tenant: { equals: id } } }),
        ])

        if (users.totalDocs > 0 || stores.totalDocs > 0 || assignments.totalDocs > 0 || invites.totalDocs > 0 || metrics.totalDocs > 0) {
          throw new APIError('Remove agency users, stores, assignments, invites, and metrics before deleting an agency.', 400)
        }
      },
    ],
    afterChange: [
      async ({ doc, operation, req, previousDoc }) => {
        await writeAuditLog({
          payload: req.payload,
          actor: req.user as any,
          action: `agency.${operation}`,
          entityType: 'agency',
          entityId: doc.id,
          agency: null,
          summary: `${operation === 'create' ? 'Created' : 'Updated'} agency ${doc.name}`,
          metadata: {
            agencyId: doc.id,
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
          action: 'agency.delete',
          entityType: 'agency',
          entityId: doc.id,
          agency: null,
          summary: `Deleted agency ${doc.name}`,
        })
      },
    ],
  },
  fields: [
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
      options: ['active', 'inactive'],
    },
    {
      name: 'primaryContactName',
      type: 'text',
    },
    {
      name: 'primaryContactEmail',
      type: 'email',
    },
    {
      name: 'primaryContactPhone',
      type: 'text',
    },
    {
      type: 'collapsible',
      label: 'Branding',
      fields: [
        {
          name: 'brandingPrimaryColor',
          type: 'text',
          defaultValue: '#1565c0',
        },
        {
          name: 'brandingSecondaryColor',
          type: 'text',
          defaultValue: '#00897b',
        },
        {
          name: 'brandingLogoUrl',
          type: 'text',
        },
      ],
    },
    {
      name: 'settings',
      type: 'json',
      defaultValue: {
        enforceMFAForAdmins: false,
        storePortalEnabled: true,
      },
    },
  ],
}
