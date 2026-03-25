import type { Payload } from 'payload'
import type { AppUserLike } from '@/lib/types'
import { getId } from '@/lib/utils'

export async function writeAuditLog(params: {
  payload: Payload
  actor?: AppUserLike | null
  action: string
  entityType: string
  entityId?: string | number | null
  agency?: string | number | null
  store?: string | number | null
  summary: string
  metadata?: Record<string, unknown>
}) {
  const { payload, actor, action, entityType, entityId, agency, store, summary, metadata } = params
  const actorId = getId(actor)
  const actorIdString = actorId ? String(actorId) : null
  const entityIdString = entityId ? String(entityId) : null
  const shouldAttachActorRelationship = Boolean(actorIdString) && !(entityType === 'user' && actorIdString === entityIdString)
  const actorMetadata = {
    actorId: actorIdString,
    actorEmail: actor?.email || null,
  }
  const nextMetadata = metadata ? { ...actorMetadata, ...metadata } : actorMetadata

  await (payload as any).create({
    collection: 'audit-logs',
    overrideAccess: true,
    data: {
      actor: shouldAttachActorRelationship ? actorId : undefined,
      action,
      entityType,
      entityId: entityId ? String(entityId) : undefined,
      agency,
      store,
      summary,
      metadata: nextMetadata,
    },
  })
}
