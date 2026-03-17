import type { CollectionConfig } from 'payload'
import { canAccessAdminPanel } from '@/lib/access'
import { isPlatformAdmin, isAgencyAdmin } from '@/lib/permissions'
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
      if (isPlatformAdmin(user)) return true
      const agencyId = getId(user?.agency)
      return isAgencyAdmin(user) && agencyId ? { agency: { equals: agencyId } } : false
    },
    create: () => false,
    update: () => false,
    delete: ({ req }) => isPlatformAdmin(req.user as any) || isAgencyAdmin(req.user as any),
  },
  fields: [
    { name: 'token', type: 'text', required: true, unique: true },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'email', type: 'email', required: true },
    { name: 'agency', type: 'relationship', relationTo: 'agencies' },
    { name: 'customer', type: 'relationship', relationTo: 'customers' },
    { name: 'invitedBy', type: 'relationship', relationTo: 'users' },
    { name: 'status', type: 'select', required: true, defaultValue: 'pending', options: ['pending', 'used', 'expired', 'revoked'] },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'usedAt', type: 'date' },
  ],
}
