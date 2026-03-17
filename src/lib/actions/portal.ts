'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { issueInvite } from '@/lib/invites'
import { getId } from '@/lib/utils'
import { canManageAgencyUsers, canManageCustomer, canManageCustomerUsers } from '@/lib/rules'
import { getAssignedCustomerIdsForUser } from '@/lib/services/portal'
import { isPlatformAdmin, isAgencyAdmin, isAgencyManager, isCustomerAdmin } from '@/lib/permissions'

function text(formData: FormData, key: string): string {
  return String(formData.get(key) || '').trim()
}

export async function createAgency(formData: FormData) {
  const actor = await requireUser()
  if (!isPlatformAdmin(actor)) {
    throw new Error('Only platform admins can create agencies.')
  }

  const payload = await getPayloadClient()
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

  const payload = await getPayloadClient()
  const requestedAgencyId = text(formData, 'agencyId')
  const agencyId = isPlatformAdmin(actor) ? requestedAgencyId : String(getId(actor.agency) || '')
  if (!agencyId) throw new Error('Agency is required.')

  const role = text(formData, 'role')
  if (!['agency-admin', 'agency-manager', 'agency-user'].includes(role)) {
    throw new Error('Invalid agency role.')
  }

  const user = await payload.create({
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

  const payload = await getPayloadClient()
  const requestedAgencyId = text(formData, 'agencyId')
  const agencyId = isPlatformAdmin(actor) ? requestedAgencyId : String(getId(actor.agency) || '')
  if (!agencyId) throw new Error('Agency is required.')

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
  const payload = await getPayloadClient()
  const customerId = text(formData, 'customerId')
  const customer = await payload.findByID({ collection: 'customers', id: customerId, overrideAccess: true, depth: 1 })
  const assignedCustomerIds = await getAssignedCustomerIdsForUser(actor)

  if (!canManageCustomerUsers({ user: actor, customer, assignedCustomerIds })) {
    throw new Error('You do not have permission to create customer users here.')
  }

  const role = text(formData, 'role')
  if (!['customer-admin', 'customer-user'].includes(role)) {
    throw new Error('Invalid customer role.')
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
      agency: getId(customer.agency),
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

  const payload = await getPayloadClient()
  const customerId = text(formData, 'customerId')
  const agencyUserId = text(formData, 'agencyUserId')
  const customer = await payload.findByID({ collection: 'customers', id: customerId, overrideAccess: true, depth: 0 })

  await payload.create({
    collection: 'agency-customer-assignments',
    overrideAccess: true,
    user: actor as any,
    data: {
      agency: getId(customer.agency),
      agencyUser: agencyUserId,
      customer: customer.id,
      assignedBy: getId(actor.id),
      status: 'active',
    },
  })

  revalidatePath(`/dashboard/customers/${customer.id}`)
  redirect(`/dashboard/customers/${customer.id}`)
}

export async function activateInvite(formData: FormData) {
  const payload = await getPayloadClient()
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
