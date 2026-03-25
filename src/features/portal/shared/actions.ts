'use server'

import { redirect } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import { getId } from '@/lib/utils'
import { text } from '@/features/portal/actions/utils'

export async function activateInvite(formData: FormData) {
  const payload = await getPayloadClient() as any
  const token = text(formData, 'token')
  const password = text(formData, 'password')
  const passwordConfirm = text(formData, 'passwordConfirm')

  if (!password || password.length < 10) {
    throw new Error('Password must be at least 10 characters long.')
  }
  if (password !== passwordConfirm) {
    throw new Error('Passwords do not match.')
  }

  const inviteQuery = await payload.find({
    collection: 'invite-tokens',
    overrideAccess: true,
    depth: 1,
    limit: 1,
    where: { token: { equals: token } },
  })

  const invite = inviteQuery.docs[0]
  if (!invite) {
    throw new Error('Invite token was not found.')
  }
  if (invite.status !== 'pending') {
    throw new Error('This invite is no longer usable.')
  }
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    await payload.update({ collection: 'invite-tokens', id: invite.id, overrideAccess: true, data: { status: 'expired' } })
    throw new Error('This invite has expired.')
  }

  await payload.update({
    collection: 'users',
    id: getId(invite.user)!,
    overrideAccess: true,
    data: {
      password,
      status: 'active',
    },
  })

  await payload.update({
    collection: 'invite-tokens',
    id: invite.id,
    overrideAccess: true,
    data: {
      status: 'used',
      usedAt: new Date().toISOString(),
    },
  })

  redirect('/login?activated=1')
}
