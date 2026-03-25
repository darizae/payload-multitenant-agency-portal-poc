import { getPayloadClient } from '@/lib/payload'
import { getVisibleStores } from '@/features/portal/storehero/services'
import { getAssignedStoreIdsForUser } from '@/features/portal/shared/services'
import { hasAutomaticAgencyWideStoreAccess, isStoreheroRole } from '@/authz/roles'
import type { AppUserLike } from '@/lib/types'
import { getId } from '@/lib/utils'
import { addDaysUTC, aggregateByBucket, startOfDayUTC, sumMetrics, toDateKey, type AnalyticsGranularity, type MetricValues, type MetricsDoc, withDeltas, ZERO_METRICS } from '@/lib/analytics-utils'

type Bucket = {
  currentLabel: string
  previousLabel: string
  current: MetricValues
  previous: MetricValues
}

export type AnalyticsReport = {
  totalsCurrent: MetricValues
  totalsPrevious: MetricValues
  deltas: MetricValues
  buckets: Bucket[]
}

export type AnalyticsQueryInput = {
  from: string
  to: string
  granularity: AnalyticsGranularity
  agencyId?: number
  storeId?: number
}

type AnalyticsDefaultRangeInput = {
  agencyId?: number
  storeId?: number
}

function fallbackRange(): { from: string; to: string } {
  const now = new Date()
  const end = startOfDayUTC(now)
  const start = addDaysUTC(end, -29)
  return {
    from: toDateKey(start),
    to: toDateKey(end),
  }
}

async function findAllMetrics(payload: any, where: any): Promise<MetricsDoc[]> {
  const docs: MetricsDoc[] = []
  let page = 1
  while (true) {
    const result = await payload.find({
      collection: 'store-daily-metrics',
      overrideAccess: true,
      depth: 0,
      page,
      limit: 1000,
      where,
      sort: 'metricDate',
    })
    docs.push(...result.docs)
    if (page >= result.totalPages) break
    page += 1
  }
  return docs
}

async function buildScopeWhere(user: AppUserLike, params: { storeId?: number; agencyId?: number }) {
  const { storeId, agencyId } = params
  if (isStoreheroRole(user)) {
    if (agencyId && storeId) {
      return {
        and: [
          { tenant: { equals: agencyId } },
          { store: { equals: storeId } },
        ],
      }
    }
    if (agencyId) {
      return { tenant: { equals: agencyId } }
    }
    if (storeId) return { store: { equals: storeId } }
    return {}
  }

  const userAgencyId = getId(user.agency)
  if (!userAgencyId) return { id: { equals: '__none__' } }
  if (agencyId && Number(agencyId) !== Number(userAgencyId)) {
    return { id: { equals: '__none__' } }
  }
  const scopedAgencyId = agencyId || Number(userAgencyId)

  if (user.role === 'store-root' || user.role === 'store-member') {
    const ownStoreId = getId(user.store)
    if (!ownStoreId) return { id: { equals: '__none__' } }
    return {
      and: [
        { tenant: { equals: scopedAgencyId } },
        { store: { equals: ownStoreId } },
      ],
    }
  }

  if (hasAutomaticAgencyWideStoreAccess(user)) {
    if (storeId) {
      return {
        and: [
          { tenant: { equals: scopedAgencyId } },
          { store: { equals: storeId } },
        ],
      }
    }
    return { tenant: { equals: scopedAgencyId } }
  }

  const assignedStoreIds = await getAssignedStoreIdsForUser(user)
  if (assignedStoreIds.length === 0) return { id: { equals: '__none__' } }

  if (storeId && !assignedStoreIds.map(String).includes(String(storeId))) {
    return { id: { equals: '__none__' } }
  }

  return {
    and: [
      { tenant: { equals: scopedAgencyId } },
      { store: { in: storeId ? [storeId] : assignedStoreIds } },
    ],
  }
}

export async function getAnalyticsReport(user: AppUserLike, input: AnalyticsQueryInput): Promise<AnalyticsReport> {
  const payload = await getPayloadClient()
  const from = startOfDayUTC(new Date(input.from))
  const to = startOfDayUTC(new Date(input.to))
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return {
      totalsCurrent: { ...ZERO_METRICS },
      totalsPrevious: { ...ZERO_METRICS },
      deltas: { ...ZERO_METRICS },
      buckets: [],
    }
  }

  const storeId = input.storeId ? Number(input.storeId) : undefined
  const agencyId = input.agencyId ? Number(input.agencyId) : undefined
  const scopeWhere = await buildScopeWhere(user, { storeId, agencyId })
  const spanDays = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1
  const previousTo = addDaysUTC(from, -1)
  const previousFrom = addDaysUTC(previousTo, -(spanDays - 1))
  const hasScopeFilters = Object.keys(scopeWhere || {}).length > 0

  const currentClauses: any[] = [
    { metricDate: { greater_than_equal: toDateKey(from) } },
    { metricDate: { less_than_equal: toDateKey(to) } },
  ]
  const previousClauses: any[] = [
    { metricDate: { greater_than_equal: toDateKey(previousFrom) } },
    { metricDate: { less_than_equal: toDateKey(previousTo) } },
  ]
  if (hasScopeFilters) {
    currentClauses.unshift(scopeWhere)
    previousClauses.unshift(scopeWhere)
  }

  const [currentDocs, previousDocs] = await Promise.all([
    findAllMetrics(payload, {
      and: currentClauses,
    }),
    findAllMetrics(payload, {
      and: previousClauses,
    }),
  ])

  const currentBuckets = aggregateByBucket(currentDocs, input.granularity)
  const previousBuckets = aggregateByBucket(previousDocs, input.granularity)
  const max = Math.max(currentBuckets.length, previousBuckets.length)
  const buckets: Bucket[] = []

  for (let index = 0; index < max; index += 1) {
    const current = currentBuckets[index]
    const previous = previousBuckets[index]
    buckets.push({
      currentLabel: current?.label || '',
      previousLabel: previous?.label || '',
      current: current?.values || { ...ZERO_METRICS },
      previous: previous?.values || { ...ZERO_METRICS },
    })
  }

  const totalsCurrent = sumMetrics(currentDocs)
  const totalsPrevious = sumMetrics(previousDocs)

  return {
    totalsCurrent,
    totalsPrevious,
    deltas: withDeltas(totalsCurrent, totalsPrevious),
    buckets,
  }
}

export async function getAnalyticsDefaultRange(
  user: AppUserLike,
  input: AnalyticsDefaultRangeInput,
): Promise<{ from: string; to: string }> {
  const payload = await getPayloadClient()
  const scopeWhere = await buildScopeWhere(user, input)
  const hasScopeFilters = Object.keys(scopeWhere || {}).length > 0
  const where = hasScopeFilters ? { and: [scopeWhere] } : {}

  const [earliest, latest] = await Promise.all([
    payload.find({
      collection: 'store-daily-metrics',
      overrideAccess: true,
      depth: 0,
      limit: 1,
      sort: 'metricDate',
      where,
    }),
    payload.find({
      collection: 'store-daily-metrics',
      overrideAccess: true,
      depth: 0,
      limit: 1,
      sort: '-metricDate',
      where,
    }),
  ])

  const minDoc = earliest.docs[0]
  const maxDoc = latest.docs[0]
  if (!minDoc || !maxDoc) {
    return fallbackRange()
  }

  const minDate = startOfDayUTC(new Date(minDoc.metricDate))
  const maxDate = startOfDayUTC(new Date(maxDoc.metricDate))
  if (Number.isNaN(minDate.getTime()) || Number.isNaN(maxDate.getTime()) || minDate > maxDate) {
    return fallbackRange()
  }

  const proposedFrom = addDaysUTC(maxDate, -29)
  const from = proposedFrom < minDate ? minDate : proposedFrom

  return {
    from: toDateKey(from),
    to: toDateKey(maxDate),
  }
}

export async function getAnalyticsStoreOptions(user: AppUserLike): Promise<Array<{ id: number; name: string }>> {
  const visible = await getVisibleStores(user)
  return visible.docs
    .map((store: any) => ({ id: Number(store.id), name: String(store.name) }))
    .filter((store: any) => Number.isFinite(store.id))
}
