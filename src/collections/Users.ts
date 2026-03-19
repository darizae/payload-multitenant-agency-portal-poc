import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { canAccessAdminPanel, usersReadAccess } from '@/lib/access'
import { validateUserBusinessRules, validateUserDeletePermissions, validateUserWritePermissions } from '@/lib/guards'
import { isPlatformAdmin, isAgencyAdmin, isCustomerAdmin } from '@/lib/permissions'
import { getId, randomToken } from '@/lib/utils'
import { issueInvite } from '@/lib/invites'
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
    defaultColumns: ['name', 'email', 'role', 'status', 'agency', 'customer'],
  },
  access: {
    admin: canAccessAdminPanel,
    read: usersReadAccess,
    create: ({ req }) => {
      const user = req.user as any
      return isPlatformAdmin(user) || isAgencyAdmin(user) || isCustomerAdmin(user)
    },
    update: ({ req }) => {
      const user = req.user as any
      if (isPlatformAdmin(user)) return true
      if (isAgencyAdmin(user)) {
        const agencyId = getId(user?.agency)
        return agencyId ? { agency: { equals: agencyId } } : false
      }
      if (isCustomerAdmin(user)) {
        const customerId = getId(user?.customer)
        return customerId ? { customer: { equals: customerId } } : false
      }
      return { id: { equals: getId(user?.id) } }
    },
    delete: ({ req }) => {
      const user = req.user as any
      if (isPlatformAdmin(user)) return true
      if (isAgencyAdmin(user)) {
        const agencyId = getId(user?.agency)
        return agencyId ? { agency: { equals: agencyId } } : false
      }
      if (isCustomerAdmin(user)) {
        const customerId = getId(user?.customer)
        return customerId ? { customer: { equals: customerId } } : false
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

        if (doc.role === 'agency-admin' && doc.status === 'active' && doc.agency) {
          const count = await req.payload.count({
            collection: 'users',
            overrideAccess: true,
            where: {
              and: [
                { agency: { equals: getId(doc.agency) } },
                { role: { equals: 'agency-admin' } },
                { status: { equals: 'active' } },
              ],
            },
          })
          if (count.totalDocs <= 1) {
            throw new APIError('You cannot delete the last active agency admin.', 400)
          }
        }

        if (doc.role === 'customer-admin' && doc.status === 'active' && doc.customer) {
          const count = await req.payload.count({
            collection: 'users',
            overrideAccess: true,
            where: {
              and: [
                { customer: { equals: getId(doc.customer) } },
                { role: { equals: 'customer-admin' } },
                { status: { equals: 'active' } },
              ],
            },
          })
          if (count.totalDocs <= 1) {
            throw new APIError('You cannot delete the last active customer admin.', 400)
          }
        }

        const assignmentCount = await req.payload.count({
          collection: 'agency-customer-assignments',
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

        if (user.customer) {
          const customer = await req.payload.findByID({
            collection: 'customers',
            id: getId(user.customer),
            overrideAccess: true,
            depth: 0,
          })

          if (!customer || customer.status !== 'active') {
            throw new APIError('This customer workspace is not active.', 403)
          }
        }

        return user
      },
    ],
    afterLogin: [
      async ({ user, req }) => {
        await req.payload.update({
          collection: 'users',
          id: user.id,
          overrideAccess: true,
          data: {
            lastLoginAt: new Date().toISOString(),
          },
        })

        await writeAuditLog({
          payload: req.payload,
          actor: user as any,
          action: 'auth.login',
          entityType: 'user',
          entityId: user.id,
          agency: getId(user.agency),
          customer: getId(user.customer),
          summary: `User ${user.email} logged in`,
        })

        return user
      },
    ],
    afterChange: [
      async ({ doc, operation, req, previousDoc }) => {
        if (operation === 'create' && doc.status === 'invited') {
          await issueInvite({
            targetUserId: doc.id,
            email: doc.email,
            actor: req.user as any,
            agency: getId(doc.agency),
            customer: getId(doc.customer),
          })
        }

        await writeAuditLog({
          payload: req.payload,
          actor: req.user as any,
          action: `user.${operation}`,
          entityType: 'user',
          entityId: doc.id,
          agency: getId(doc.agency),
          customer: getId(doc.customer),
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
          customer: getId(doc.customer),
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
        'platform-admin',
        'agency-admin',
        'agency-manager',
        'agency-user',
        'customer-admin',
        'customer-user',
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
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'hasGlobalCustomerAccess',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Useful for managers or specialists who should see every customer inside their agency.',
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
