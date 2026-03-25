'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { isStoreheroRole } from '@/authz/roles'
import { text } from '@/features/portal/actions/utils'

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
