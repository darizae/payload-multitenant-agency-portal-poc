import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { canAccessAdminPanel, getAssignedStoreIds } from '@/lib/access'
import { isAgencyMember, isAgencyRoot, isStoreheroRole } from '@/lib/permissions'
import { validateAssignmentWritePermissions } from '@/lib/guards'
import { getId } from '@/lib/utils'
import { writeAuditLog } from '@/lib/audit'

export const AgencyStoreAssignments: CollectionConfig = {
  slug: 'agency-store-assignments',
  admin: {
    useAsTitle: 'assignmentLabel',
    defaultColumns: ['agencyUser', 'store', 'status', 'assignedAt'],
  },
  access: {
    admin: canAccessAdminPanel,
    read: async ({ req }) => {
      const user = req.user as any
      if (!user) return false
      if (isStoreheroRole(user)) return true
      const role = String(user?.role || '')
      const agencyId = getId(user?.agency)
      if (!agencyId) return false
      if (isAgencyRoot(user) || isAgencyMember(user)) {
        return { agency: { equals: agencyId } }
      }
      if (role === 'store-root' || role === 'store-member') {
        const storeId = getId(user?.store)
        return storeId ? { store: { equals: storeId } } : false
      }
      const userId = getId(user?.id)
      if (!userId) return false
      const assignedStoreIds = await getAssignedStoreIds(req)
      if (assignedStoreIds.length === 0) {
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
              { store: { in: assignedStoreIds } },
            ],
          },
        ],
      }
    },
    create: ({ req }) => isStoreheroRole(req.user as any) || isAgencyRoot(req.user as any),
    update: ({ req }) => {
      const user = req.user as any
      if (isStoreheroRole(user)) return true
      if (isAgencyRoot(user)) {
        const agencyId = getId(user?.agency)
        return agencyId ? { agency: { equals: agencyId } } : false
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
    beforeValidate: [
      async ({ data, req, originalDoc }) => {
        if (!data && !originalDoc) return data
        const draft = {
          ...originalDoc,
          ...(data || {}),
        }
        const agencyUserId = getId(draft.agencyUser)
        const storeId = getId(draft.store)
        const agencyId = getId(draft.agency)

        if (!agencyUserId || !storeId || !agencyId) return data
        validateAssignmentWritePermissions({
          actor: req.user as any,
          assignmentAgency: agencyId,
        })

        const [agencyUser, store] = await Promise.all([
          req.payload.findByID({ collection: 'users', id: agencyUserId, overrideAccess: true, depth: 0 }),
          req.payload.findByID({ collection: 'stores', id: storeId, overrideAccess: true, depth: 0 }),
        ])

        if (!agencyUser || !store) throw new APIError('Assignment references are invalid.', 400)

        if (agencyUser.role === 'store-root' || agencyUser.role === 'store-member') {
          throw new APIError('Only agency-side users can be assigned to stores.', 400)
        }

        if (String(getId(agencyUser.agency)) !== String(agencyId) || String(getId(store.agency)) !== String(agencyId)) {
          throw new APIError('Assignment agency, agency user, and store must all belong to the same agency.', 400)
        }

        if (draft.status === 'active') {
          const existing = await req.payload.find({
            collection: 'agency-store-assignments',
            depth: 0,
            limit: 1,
            overrideAccess: true,
            where: {
              and: [
                { agencyUser: { equals: agencyUserId } },
                { store: { equals: storeId } },
                { status: { equals: 'active' } },
              ],
            },
          })

          const currentId = getId(originalDoc?.id)
          if (existing.totalDocs > 0 && String(existing.docs[0].id) !== String(currentId)) {
            throw new APIError('This agency user is already actively assigned to that store.', 400)
          }
        }

        const nextData = data || {}
        nextData.assignmentLabel = `${agencyUser.name || agencyUser.email} -> ${store.name}`
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
          store: getId(doc.store),
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
          store: getId(doc.store),
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
      name: 'store',
      type: 'relationship',
      relationTo: 'stores',
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
