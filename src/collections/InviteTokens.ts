import type { CollectionConfig } from 'payload'
import { canAccessAdminPanel } from '@/authz/payload-access'
import { isAgencyRoot, isStoreheroRole } from '@/authz/roles'
import { getId } from '@/lib/utils'

export const InviteTokens: CollectionConfig = {
  slug: 'invite-tokens',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'status', 'expiresAt', 'usedAt'],
    hidden: false,
  },
  access: {
    admin: canAccessAdminPanel,
    read: ({ req }) => {
      const user = req.user as any
      if (!user) return false
      if (isStoreheroRole(user)) return true
      const agencyId = getId(user?.agency)
      return isAgencyRoot(user) && agencyId ? { agency: { equals: agencyId } } : false
    },
    create: () => false,
    update: () => false,
    delete: ({ req }) => isStoreheroRole(req.user as any) || isAgencyRoot(req.user as any),
  },
  fields: [
    { name: 'token', type: 'text', required: true, unique: true },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'email', type: 'email', required: true },
    { name: 'agency', type: 'relationship', relationTo: 'agencies' },
    { name: 'store', type: 'relationship', relationTo: 'stores' },
    { name: 'invitedBy', type: 'relationship', relationTo: 'users' },
    { name: 'status', type: 'select', required: true, defaultValue: 'pending', options: ['pending', 'used', 'expired', 'revoked'] },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'usedAt', type: 'date' },
  ],
}
