import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { canAccessAdminPanel, metricsReadAccess } from '@/lib/access'
import { isStoreheroRole } from '@/lib/permissions'
import { getId } from '@/lib/utils'
import { writeAuditLog } from '@/lib/audit'

export const StoreDailyMetrics: CollectionConfig = {
  slug: 'store-daily-metrics',
  admin: {
    useAsTitle: 'metricDate',
    defaultColumns: ['tenant', 'store', 'metricDate', 'netSales', 'grossProfit', 'marketingAdSpend', 'mer'],
  },
  access: {
    admin: canAccessAdminPanel,
    read: metricsReadAccess,
    create: ({ req }) => isStoreheroRole(req.user as any),
    update: ({ req }) => isStoreheroRole(req.user as any),
    delete: ({ req }) => isStoreheroRole(req.user as any),
  },
  hooks: {
    beforeChange: [
      async ({ req, data, originalDoc }) => {
        const tenantId = getId(data?.tenant ?? originalDoc?.tenant)
        const storeId = getId(data?.store ?? originalDoc?.store)
        const metricDate = String(data?.metricDate ?? originalDoc?.metricDate ?? '')
        if (!tenantId || !storeId || !metricDate) return data

        const existing = await req.payload.find({
          collection: 'store-daily-metrics',
          overrideAccess: true,
          depth: 0,
          limit: 1,
          where: {
            and: [
              { tenant: { equals: tenantId } },
              { store: { equals: storeId } },
              { metricDate: { equals: metricDate } },
            ],
          },
        })

        const existingDoc = existing.docs[0]
        if (existingDoc && String(existingDoc.id) !== String(getId(originalDoc?.id))) {
          throw new APIError('A metric row for this tenant, store, and date already exists.', 400)
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        await writeAuditLog({
          payload: req.payload,
          actor: req.user as any,
          action: `store-metric.${operation}`,
          entityType: 'store-daily-metric',
          entityId: doc.id,
          agency: getId(doc.tenant),
          store: getId(doc.store),
          summary: `${operation === 'create' ? 'Created' : 'Updated'} store daily metric row`,
          metadata: {
            metricDate: doc.metricDate,
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
          action: 'store-metric.delete',
          entityType: 'store-daily-metric',
          entityId: doc.id,
          agency: getId(doc.tenant),
          store: getId(doc.store),
          summary: 'Deleted store daily metric row',
          metadata: {
            metricDate: doc.metricDate,
          },
        })
      },
    ],
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'agencies',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'store',
      type: 'relationship',
      relationTo: 'stores',
      required: true,
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'shopify',
      options: ['shopify'],
    },
    {
      name: 'metricDate',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
    },
    {
      name: 'netSales',
      type: 'number',
      required: true,
    },
    {
      name: 'grossProfit',
      type: 'number',
      required: true,
    },
    {
      name: 'marketingAdSpend',
      type: 'number',
      required: true,
    },
    {
      name: 'mer',
      type: 'number',
      required: true,
    },
  ],
}
