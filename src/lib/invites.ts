import { getPayloadClient } from '@/lib/payload'
import type { AppUserLike } from '@/lib/types'
import { addHours, getId, randomToken } from '@/lib/utils'
import { writeAuditLog } from '@/lib/audit'

const ttlHours = Number(process.env.INVITE_TOKEN_TTL_HOURS || 72)

export async function issueInvite(params: {
  targetUserId: string | number
  email: string
  actor?: AppUserLike | null
  agency?: string | number | null
  store?: string | number | null
}) {
  const payload = await getPayloadClient() as any
  const token = randomToken(20)
  const expiresAt = addHours(new Date(), ttlHours).toISOString()

  const invite = await payload.create({
    collection: 'invite-tokens',
    overrideAccess: true,
    data: {
      token,
      user: params.targetUserId,
      email: params.email,
      agency: params.agency || undefined,
      store: params.store || undefined,
      invitedBy: getId(params.actor),
      expiresAt,
      status: 'pending',
    },
  })

  await writeAuditLog({
    payload,
    actor: params.actor,
    action: 'invite.issued',
    entityType: 'invite-token',
    entityId: invite.id,
    agency: params.agency || undefined,
    store: params.store || undefined,
    summary: `Issued invite for ${params.email}`,
    metadata: {
      tokenPreview: token.slice(0, 10),
      expiresAt,
    },
  })

  return invite
}
