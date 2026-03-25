import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { canAccessAdminPanel, usersReadAccess } from '@/authz/payload-access'
import { validateUserBusinessRules, validateUserDeletePermissions, validateUserWritePermissions } from '@/authz/policies'
import { isAgencyRoot, isStoreRoot, isStoreheroRole } from '@/authz/roles'
import { getId, randomToken } from '@/lib/utils'
import { writeAuditLog } from '@/lib/audit'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    tokenExpiration: 60 * 60 * 8,
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'role', 'status', 'agency', 'store'],
  },
  access: {
    admin: canAccessAdminPanel,
    read: usersReadAccess,
    create: ({ req }) => {
      const user = req.user as any
      return isStoreheroRole(user) || isAgencyRoot(user) || isStoreRoot(user)
    },
    update: ({ req }) => {
      const user = req.user as any
      if (isStoreheroRole(user)) return true
      if (isAgencyRoot(user)) {
        const agencyId = getId(user?.agency)
        return agencyId ? { agency: { equals: agencyId } } : false
      }
      if (isStoreRoot(user)) {
        const storeId = getId(user?.store)
        return storeId ? { store: { equals: storeId } } : false
      }
      return { id: { equals: getId(user?.id) } }
    },
    delete: ({ req }) => {
      const user = req.user as any
      if (isStoreheroRole(user)) return true
      if (isAgencyRoot(user)) {
        const agencyId = getId(user?.agency)
        return agencyId ? { agency: { equals: agencyId } } : false
      }
      if (isStoreRoot(user)) {
        const storeId = getId(user?.store)
        return storeId ? { store: { equals: storeId } } : false
      }
      return false
    },
  },
  hooks: {
    beforeValidate: [
      async ({ data, operation }) => {
        if (operation === 'create' && data && !data.password) {
          data.password = randomToken(16)
          data.status = data.status || 'invited'
        }
        return data
      },
    ],
    beforeChange: [
      async ({ data, req, originalDoc, operation }) => {
        const next = await validateUserBusinessRules({
          payload: req.payload,
          originalDoc,
          nextData: data || {},
        })
        validateUserWritePermissions({
          actor: req.user as any,
          originalDoc,
          nextData: next,
          operation,
        })
        return next
      },
    ],
    beforeDelete: [
      async ({ req, id }) => {
        const doc = await req.payload.findByID({ collection: 'users', id, overrideAccess: true, depth: 0 })
        if (!doc) return
        validateUserDeletePermissions({
          actor: req.user as any,
          targetDoc: doc,
        })

        if (doc.role === 'agency-root' && doc.status === 'active' && doc.agency) {
          const count = await req.payload.count({
            collection: 'users',
            overrideAccess: true,
            where: {
              and: [
                { agency: { equals: getId(doc.agency) } },
                { role: { equals: 'agency-root' } },
                { status: { equals: 'active' } },
              ],
            },
          })
          if (count.totalDocs <= 1) {
            throw new APIError('You cannot delete the last active agency root user.', 400)
          }
        }

        if (doc.role === 'store-root' && doc.status === 'active' && doc.store) {
          const count = await req.payload.count({
            collection: 'users',
            overrideAccess: true,
            where: {
              and: [
                { store: { equals: getId(doc.store) } },
                { role: { equals: 'store-root' } },
                { status: { equals: 'active' } },
              ],
            },
          })
          if (count.totalDocs <= 1) {
            throw new APIError('You cannot delete the last active store root user.', 400)
          }
        }

        const assignmentCount = await req.payload.count({
          collection: 'agency-store-assignments',
          overrideAccess: true,
          where: {
            agencyUser: { equals: id },
          },
        })
        if (assignmentCount.totalDocs > 0) {
          throw new APIError('Remove assignments linked to this user before deleting them.', 400)
        }

        while (true) {
          const invites = await req.payload.find({
            collection: 'invite-tokens',
            overrideAccess: true,
            depth: 0,
            limit: 100,
            where: {
              user: { equals: id },
            },
          })
          if (invites.totalDocs === 0) break
          for (const invite of invites.docs) {
            await req.payload.delete({
              collection: 'invite-tokens',
              id: invite.id,
              overrideAccess: true,
            })
          }
        }
      },
    ],
    beforeLogin: [
      async ({ user, req }) => {
        if (user.status !== 'active') {
          throw new APIError('Account is not active. Use the invite link first or ask an admin to reactivate you.', 403)
        }

        if (user.agency) {
          const agency = await req.payload.findByID({
            collection: 'agencies',
            id: getId(user.agency),
            overrideAccess: true,
            depth: 0,
          })

          if (agency?.status !== 'active') {
            throw new APIError('The agency is deactivated and cannot log in.', 403)
          }
        }

        if (user.store) {
          const store = await req.payload.findByID({
            collection: 'stores',
            id: getId(user.store),
            overrideAccess: true,
            depth: 0,
          })

          if (!store || store.status !== 'active') {
            throw new APIError('This store workspace is not active.', 403)
          }
        }

        return user
      },
    ],
    afterLogin: [
      async ({ user, req }) => {
        await writeAuditLog({
          payload: req.payload,
          actor: user as any,
          action: 'auth.login',
          entityType: 'user',
          entityId: user.id,
          agency: getId(user.agency),
          store: getId(user.store),
          summary: `User ${user.email} logged in`,
        })

        return user
      },
    ],
    afterChange: [
      async ({ doc, operation, req, previousDoc }) => {
        await writeAuditLog({
          payload: req.payload,
          actor: req.user as any,
          action: `user.${operation}`,
          entityType: 'user',
          entityId: doc.id,
          agency: getId(doc.agency),
          store: getId(doc.store),
          summary: `${operation === 'create' ? 'Created' : 'Updated'} user ${doc.email}`,
          metadata: {
            previousRole: previousDoc?.role,
            nextRole: doc.role,
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
          action: 'user.delete',
          entityType: 'user',
          entityId: doc.id,
          agency: getId(doc.agency),
          store: getId(doc.store),
          summary: `Deleted user ${doc.email}`,
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
      name: 'role',
      type: 'select',
      required: true,
      options: [
        'storehero-root',
        'storehero-member',
        'agency-root',
        'agency-member',
        'store-root',
        'store-member',
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: ['invited', 'active', 'suspended', 'deactivated'],
    },
    {
      name: 'agency',
      type: 'relationship',
      relationTo: 'agencies',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'store',
      type: 'relationship',
      relationTo: 'stores',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'hasGlobalStoreAccess',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Useful for agency members who should see every store inside their agency.',
      },
    },
    {
      name: 'lastLoginAt',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
  ],
}
