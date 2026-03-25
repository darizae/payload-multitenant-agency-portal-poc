'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getId } from '@/lib/utils'
import { canManageAgencyUsers } from '@/authz/ui-rules'
import { isAgencyRoot, isStoreheroRole } from '@/authz/roles'
import { issueInvite } from '@/lib/invites'
import { getAgencyById, text } from '@/features/portal/actions/utils'

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
