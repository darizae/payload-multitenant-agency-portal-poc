import type { CollectionConfig } from 'payload'
import { auditLogReadAccess, canAccessAdminPanel } from '@/lib/access'

export const AuditLogs: CollectionConfig = {
  slug: 'audit-logs',
  admin: {
    useAsTitle: 'summary',
    defaultColumns: ['action', 'entityType', 'summary', 'createdAt'],
  },
  access: {
    admin: canAccessAdminPanel,
    read: auditLogReadAccess,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'actor', type: 'relationship', relationTo: 'users' },
    { name: 'action', type: 'text', required: true },
    { name: 'entityType', type: 'text', required: true },
    { name: 'entityId', type: 'text' },
    { name: 'agency', type: 'relationship', relationTo: 'agencies' },
    { name: 'store', type: 'relationship', relationTo: 'stores' },
    { name: 'summary', type: 'textarea', required: true },
    { name: 'metadata', type: 'json' },
  ],
}
