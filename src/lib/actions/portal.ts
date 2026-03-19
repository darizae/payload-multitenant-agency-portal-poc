'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getId } from '@/lib/utils'
import { canManageAgencyUsers, canManageCustomerUsers } from '@/lib/rules'
import { getAssignedCustomerIdsForUser } from '@/lib/services/portal'
import { isPlatformAdmin, isAgencyAdmin, isAgencyManager } from '@/lib/permissions'

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

async function getCustomerById(payload: any, customerId: number) {
  const result = await payload.find({
    collection: 'customers',
    overrideAccess: true,
    depth: 1,
    limit: 1,
    where: { id: { equals: customerId } },
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
  if (!isPlatformAdmin(actor)) {
    throw new Error('Only platform admins can create agencies.')
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
  const agencyId = isPlatformAdmin(actor) ? requestedAgencyId : getId(actor.agency)
  if (typeof agencyId !== 'number') throw new Error('Agency is required.')
  if (!(await getAgencyById(payload, agencyId))) throw new Error('Agency was not found.')

  const role = text(formData, 'role')
  if (!['agency-admin', 'agency-manager', 'agency-user'].includes(role)) {
    throw new Error('Invalid agency role.')
  }

  await payload.create({
    collection: 'users',
    overrideAccess: true,
    user: actor as any,
    data: {
      name: text(formData, 'name'),
      email: text(formData, 'email').toLowerCase(),
      role,
      status: 'invited',
      agency: agencyId,
      hasGlobalCustomerAccess: formData.get('hasGlobalCustomerAccess') === 'on',
    },
  })

  revalidatePath(`/dashboard/agencies/${agencyId}`)
  redirect(`/dashboard/agencies/${agencyId}`)
}

export async function createCustomer(formData: FormData) {
  const actor = await requireUser()
  if (!(isPlatformAdmin(actor) || isAgencyAdmin(actor) || isAgencyManager(actor))) {
    throw new Error('You do not have permission to create customers.')
  }

  const payload = await getPayloadClient() as any
  const requestedAgencyId = getId(text(formData, 'agencyId'))
  const agencyId = isPlatformAdmin(actor) ? requestedAgencyId : getId(actor.agency)
  if (typeof agencyId !== 'number') throw new Error('Agency is required.')
  if (!(await getAgencyById(payload, agencyId))) throw new Error('Agency was not found.')

  const customer = await payload.create({
    collection: 'customers',
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
  redirect(`/dashboard/customers/${customer.id}`)
}

export async function createCustomerUser(formData: FormData) {
  const actor = await requireUser()
  const payload = await getPayloadClient() as any
  const customerId = getId(text(formData, 'customerId'))
  if (typeof customerId !== 'number') {
    throw new Error('Customer is required.')
  }
  const customer = await getCustomerById(payload, customerId)
  if (!customer) {
    throw new Error('Customer was not found.')
  }
  const assignedCustomerIds = await getAssignedCustomerIdsForUser(actor)

  if (!canManageCustomerUsers({ user: actor, customer, assignedCustomerIds })) {
    throw new Error('You do not have permission to create customer users here.')
  }

  const role = text(formData, 'role')
  if (!['customer-admin', 'customer-user'].includes(role)) {
    throw new Error('Invalid customer role.')
  }

  const customerAgencyId = getId(customer.agency)
  if (typeof customerAgencyId !== 'number') {
    throw new Error('Customer agency is invalid.')
  }

  await payload.create({
    collection: 'users',
    overrideAccess: true,
    user: actor as any,
    data: {
      name: text(formData, 'name'),
      email: text(formData, 'email').toLowerCase(),
      role,
      status: 'invited',
      agency: customerAgencyId,
      customer: customer.id,
    },
  })

  revalidatePath(`/dashboard/customers/${customer.id}`)
  redirect(`/dashboard/customers/${customer.id}`)
}

export async function createAssignment(formData: FormData) {
  const actor = await requireUser()
  if (!(isPlatformAdmin(actor) || isAgencyAdmin(actor))) {
    throw new Error('Only platform admins and agency admins can create assignments.')
  }

  const payload = await getPayloadClient() as any
  const customerId = getId(text(formData, 'customerId'))
  if (typeof customerId !== 'number') {
    throw new Error('Customer is required.')
  }
  const agencyUserId = getId(text(formData, 'agencyUserId'))
  if (typeof agencyUserId !== 'number') {
    throw new Error('Agency user is required.')
  }
  const [customer, agencyUser] = await Promise.all([
    getCustomerById(payload, customerId),
    getUserById(payload, agencyUserId),
  ])

  if (!customer) {
    throw new Error('Customer was not found.')
  }
  if (!agencyUser) {
    throw new Error('Agency user was not found.')
  }
  if (agencyUser.role === 'customer-admin' || agencyUser.role === 'customer-user') {
    throw new Error('Only agency-side users can be assigned to customers.')
  }

  const customerAgencyId = getId(customer.agency)
  const agencyUserAgencyId = getId(agencyUser.agency)
  if (typeof customerAgencyId !== 'number' || typeof agencyUserAgencyId !== 'number' || customerAgencyId !== agencyUserAgencyId) {
    throw new Error('Customer and agency user must belong to the same agency.')
  }

  if (!isPlatformAdmin(actor) && getId(actor.agency) !== customerAgencyId) {
    throw new Error('You do not have permission to assign users outside your agency.')
  }

  const assignedBy = getId(actor.id)

  await payload.create({
    collection: 'agency-customer-assignments',
    overrideAccess: true,
    user: actor as any,
    data: {
      agency: customerAgencyId,
      agencyUser: agencyUserId,
      customer: customer.id,
      assignedBy: typeof assignedBy === 'number' ? assignedBy : undefined,
      status: 'active',
    },
  })

  revalidatePath(`/dashboard/customers/${customer.id}`)
  redirect(`/dashboard/customers/${customer.id}`)
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
