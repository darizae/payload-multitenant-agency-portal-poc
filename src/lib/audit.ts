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
  customer?: string | number | null
  summary: string
  metadata?: Record<string, unknown>
}) {
  const { payload, actor, action, entityType, entityId, agency, customer, summary, metadata } = params

  await payload.create({
    collection: 'audit-logs',
    overrideAccess: true,
    data: {
      actor: getId(actor),
      action,
      entityType,
      entityId: entityId ? String(entityId) : undefined,
      agency,
      customer,
      summary,
      metadata,
    },
  })
}
