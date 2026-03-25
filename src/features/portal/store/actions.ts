'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getId } from '@/lib/utils'
import { canManageStoreUsers, canWriteMetricsForStore } from '@/authz/ui-rules'
import { isAgencyRoot, isStoreheroRole } from '@/authz/roles'
import { issueInvite } from '@/lib/invites'
import { getAssignedStoreIdsForUser } from '@/features/portal/shared/services'
import { getStoreById, getUserById, metricNumber, text } from '@/features/portal/actions/utils'

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

export async function createStoreMetric(formData: FormData) {
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

  const storeAgencyId = getId(store.agency)
  if (typeof storeAgencyId !== 'number') {
    throw new Error('Store agency is invalid.')
  }

  const requestedTenantId = getId(text(formData, 'tenantId'))
  if (requestedTenantId && requestedTenantId !== storeAgencyId) {
    throw new Error('Metric tenant must match the store agency.')
  }

  const assignedStoreIds = await getAssignedStoreIdsForUser(actor)
  if (!canWriteMetricsForStore({ user: actor, store, assignedStoreIds })) {
    throw new Error('You do not have permission to write metrics for this store.')
  }

  const metricDate = text(formData, 'metricDate')
  const metricData = {
    tenant: storeAgencyId,
    store: store.id,
    source: 'shopify',
    metricDate,
    netSales: metricNumber(formData, 'netSales'),
    grossProfit: metricNumber(formData, 'grossProfit'),
    marketingAdSpend: metricNumber(formData, 'marketingAdSpend'),
    mer: metricNumber(formData, 'mer'),
  }

  const existing = await payload.find({
    collection: 'store-daily-metrics',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: {
      and: [
        { tenant: { equals: storeAgencyId } },
        { store: { equals: store.id } },
        { metricDate: { equals: metricDate } },
      ],
    },
  })

  const existingDoc = existing.docs[0]
  if (existingDoc?.id) {
    await payload.update({
      collection: 'store-daily-metrics',
      id: existingDoc.id,
      overrideAccess: true,
      user: actor as any,
      data: metricData,
    })
  } else {
    await payload.create({
      collection: 'store-daily-metrics',
      overrideAccess: true,
      user: actor as any,
      data: metricData,
    })
  }

  const returnPathRaw = text(formData, 'returnPath')
  const returnPath = returnPathRaw.startsWith('/dashboard/') ? returnPathRaw : `/dashboard/stores/${store.id}`
  revalidatePath(returnPath)
  revalidatePath(`/dashboard/stores/${store.id}`)
  revalidatePath(`/dashboard/agencies/${storeAgencyId}`)
  redirect(returnPath)
}
