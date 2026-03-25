'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getId } from '@/lib/utils'
import { canManageAgencyUsers, canManageStoreUsers } from '@/lib/rules'
import { getAssignedStoreIdsForUser } from '@/lib/services/portal'
import { isAgencyRoot, isStoreheroRole } from '@/lib/permissions'
import { issueInvite } from '@/lib/invites'

function text(formData: FormData, key: string): string {
  return String(formData.get(key) || '').trim()
}

async function getAgencyById(payload: any, agencyId: number) {
  const result = await payload.find({
    collection: 'agencies',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { id: { equals: agencyId } },
  })
  return result.docs[0] || null
}

async function getStoreById(payload: any, storeId: number) {
  const result = await payload.find({
    collection: 'stores',
    overrideAccess: true,
    depth: 1,
    limit: 1,
    where: { id: { equals: storeId } },
  })
  return result.docs[0] || null
}

async function getUserById(payload: any, userId: number) {
  const result = await payload.find({
    collection: 'users',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { id: { equals: userId } },
  })
  return result.docs[0] || null
}

export async function createAgency(formData: FormData) {
  const actor = await requireUser()
  if (!isStoreheroRole(actor)) {
    throw new Error('Only Storehero users can create agencies.')
  }

  const payload = await getPayloadClient() as any
  const agency = await payload.create({
    collection: 'agencies',
    overrideAccess: true,
    data: {
      name: text(formData, 'name'),
      status: text(formData, 'status') || 'active',
      primaryContactName: text(formData, 'primaryContactName'),
      primaryContactEmail: text(formData, 'primaryContactEmail'),
      primaryContactPhone: text(formData, 'primaryContactPhone'),
    },
    user: actor as any,
  })

  revalidatePath('/dashboard/agencies')
  redirect(`/dashboard/agencies/${agency.id}`)
}

export async function createAgencyUser(formData: FormData) {
  const actor = await requireUser()
  if (!canManageAgencyUsers(actor)) {
    throw new Error('You do not have permission to create agency users.')
  }

  const payload = await getPayloadClient() as any
  const requestedAgencyId = getId(text(formData, 'agencyId'))
  const agencyId = isStoreheroRole(actor) ? requestedAgencyId : getId(actor.agency)
  if (typeof agencyId !== 'number') throw new Error('Agency is required.')
  if (!(await getAgencyById(payload, agencyId))) throw new Error('Agency was not found.')

  const role = text(formData, 'role')
  if (!['agency-root', 'agency-member'].includes(role)) {
    throw new Error('Invalid agency role.')
  }

  const created = await payload.create({
    collection: 'users',
    overrideAccess: true,
    user: actor as any,
    data: {
      name: text(formData, 'name'),
      email: text(formData, 'email').toLowerCase(),
      role,
      status: 'invited',
      agency: agencyId,
      hasGlobalStoreAccess: formData.get('hasGlobalStoreAccess') === 'on',
    },
  })

  await issueInvite({
    targetUserId: created.id,
    email: created.email,
    actor,
    agency: agencyId,
  })

  revalidatePath(`/dashboard/agencies/${agencyId}`)
  redirect(`/dashboard/agencies/${agencyId}`)
}

export async function createStore(formData: FormData) {
  const actor = await requireUser()
  if (!(isStoreheroRole(actor) || isAgencyRoot(actor))) {
    throw new Error('You do not have permission to create stores.')
  }

  const payload = await getPayloadClient() as any
  const requestedAgencyId = getId(text(formData, 'agencyId'))
  const agencyId = isStoreheroRole(actor) ? requestedAgencyId : getId(actor.agency)
  if (typeof agencyId !== 'number') throw new Error('Agency is required.')
  if (!(await getAgencyById(payload, agencyId))) throw new Error('Agency was not found.')

  const store = await payload.create({
    collection: 'stores',
    overrideAccess: true,
    user: actor as any,
    data: {
      agency: agencyId,
      name: text(formData, 'name'),
      status: text(formData, 'status') || 'active',
      contactName: text(formData, 'contactName'),
      contactEmail: text(formData, 'contactEmail'),
      contactPhone: text(formData, 'contactPhone'),
    },
  })

  revalidatePath(`/dashboard/agencies/${agencyId}`)
  redirect(`/dashboard/stores/${store.id}`)
}

export async function createStoreUser(formData: FormData) {
  const actor = await requireUser()
  const payload = await getPayloadClient() as any
  const storeId = getId(text(formData, 'storeId'))
  if (typeof storeId !== 'number') {
    throw new Error('Store is required.')
  }
  const store = await getStoreById(payload, storeId)
  if (!store) {
    throw new Error('Store was not found.')
  }
  const assignedStoreIds = await getAssignedStoreIdsForUser(actor)

  if (!canManageStoreUsers({ user: actor, store, assignedStoreIds })) {
    throw new Error('You do not have permission to create store users here.')
  }

  const role = text(formData, 'role')
  if (!['store-root', 'store-member'].includes(role)) {
    throw new Error('Invalid store role.')
  }

  const storeAgencyId = getId(store.agency)
  if (typeof storeAgencyId !== 'number') {
    throw new Error('Store agency is invalid.')
  }

  const created = await payload.create({
    collection: 'users',
    overrideAccess: true,
    user: actor as any,
    data: {
      name: text(formData, 'name'),
      email: text(formData, 'email').toLowerCase(),
      role,
      status: 'invited',
      agency: storeAgencyId,
      store: store.id,
    },
  })

  await issueInvite({
    targetUserId: created.id,
    email: created.email,
    actor,
    agency: storeAgencyId,
    store: store.id,
  })

  revalidatePath(`/dashboard/stores/${store.id}`)
  redirect(`/dashboard/stores/${store.id}`)
}

export async function createAssignment(formData: FormData) {
  const actor = await requireUser()
  if (!(isStoreheroRole(actor) || isAgencyRoot(actor))) {
    throw new Error('Only Storehero and agency root users can create assignments.')
  }

  const payload = await getPayloadClient() as any
  const storeId = getId(text(formData, 'storeId'))
  if (typeof storeId !== 'number') {
    throw new Error('Store is required.')
  }
  const agencyUserId = getId(text(formData, 'agencyUserId'))
  if (typeof agencyUserId !== 'number') {
    throw new Error('Agency user is required.')
  }
  const [store, agencyUser] = await Promise.all([
    getStoreById(payload, storeId),
    getUserById(payload, agencyUserId),
  ])

  if (!store) {
    throw new Error('Store was not found.')
  }
  if (!agencyUser) {
    throw new Error('Agency user was not found.')
  }
  if (agencyUser.role === 'store-root' || agencyUser.role === 'store-member') {
    throw new Error('Only agency-side users can be assigned to stores.')
  }

  const storeAgencyId = getId(store.agency)
  const agencyUserAgencyId = getId(agencyUser.agency)
  if (typeof storeAgencyId !== 'number' || typeof agencyUserAgencyId !== 'number' || storeAgencyId !== agencyUserAgencyId) {
    throw new Error('Store and agency user must belong to the same agency.')
  }

  if (!isStoreheroRole(actor) && getId(actor.agency) !== storeAgencyId) {
    throw new Error('You do not have permission to assign users outside your agency.')
  }

  const assignedBy = getId(actor.id)

  await payload.create({
    collection: 'agency-store-assignments',
    overrideAccess: true,
    user: actor as any,
    data: {
      agency: storeAgencyId,
      agencyUser: agencyUserId,
      store: store.id,
      assignedBy: typeof assignedBy === 'number' ? assignedBy : undefined,
      status: 'active',
    },
  })

  revalidatePath(`/dashboard/stores/${store.id}`)
  redirect(`/dashboard/stores/${store.id}`)
}

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
