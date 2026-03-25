import { getPayloadClient } from '@/lib/payload'
import { isStoreheroRole } from '@/authz/roles'
import type { AppUserLike } from '@/lib/types'
import { getId } from '@/lib/utils'

export async function getAssignedStoreIdsForUser(user?: AppUserLike | null): Promise<Array<string | number>> {
  const payload = await getPayloadClient()
  const userId = getId(user?.id)
  if (!userId) return []

  const result = await payload.find({
    collection: 'agency-store-assignments',
    overrideAccess: true,
    depth: 0,
    limit: 500,
    where: {
      and: [
        { agencyUser: { equals: userId } },
        { status: { equals: 'active' } },
      ],
    },
  })

  return result.docs.map((doc: any) => doc.store).filter(Boolean)
}

export async function getAgencyBrandingForUser(user: AppUserLike): Promise<{
  primaryColor?: string | null
  secondaryColor?: string | null
  logoUrl?: string | null
  agencyName?: string | null
} | null> {
  if (isStoreheroRole(user)) {
    return null
  }

  const agencyId = getId(user.agency)
  if (!agencyId) return null

  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'agencies',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { id: { equals: agencyId } },
  })

  const agency = result.docs[0]
  if (!agency) return null

  return {
    primaryColor: agency.brandingPrimaryColor,
    secondaryColor: agency.brandingSecondaryColor,
    logoUrl: agency.brandingLogoUrl,
    agencyName: agency.name,
  }
}
