export type AnalyticsGranularity = 'day' | 'week' | 'month' | 'year'

export type MetricValues = {
  netSales: number
  grossProfit: number
  marketingAdSpend: number
  mer: number
}

export type MetricsDoc = {
  metricDate: string
  netSales?: number
  grossProfit?: number
  marketingAdSpend?: number
  mer?: number
}

export const ZERO_METRICS: MetricValues = {
  netSales: 0,
  grossProfit: 0,
  marketingAdSpend: 0,
  mer: 0,
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function addDaysUTC(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

export function bucketKey(date: Date, granularity: AnalyticsGranularity): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  if (granularity === 'day') return `${year}-${month}-${day}`
  if (granularity === 'month') return `${year}-${month}`
  if (granularity === 'year') return String(year)
  const { isoYear, isoWeek } = getIsoWeek(date)
  return `${isoYear}-W${String(isoWeek).padStart(2, '0')}`
}

export function getIsoWeek(date: Date): { isoYear: number; isoWeek: number } {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNumber = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber)
  const isoYear = target.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const isoWeek = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return { isoYear, isoWeek }
}

export function mergeMetrics(target: MetricValues, doc: MetricsDoc): MetricValues {
  return {
    netSales: target.netSales + Number(doc.netSales || 0),
    grossProfit: target.grossProfit + Number(doc.grossProfit || 0),
    marketingAdSpend: target.marketingAdSpend + Number(doc.marketingAdSpend || 0),
    mer: target.mer + Number(doc.mer || 0),
  }
}

export function aggregateByBucket(docs: MetricsDoc[], granularity: AnalyticsGranularity): Array<{ label: string; values: MetricValues }> {
  const grouped = new Map<string, MetricValues>()

  for (const doc of docs) {
    const date = startOfDayUTC(new Date(doc.metricDate))
    const key = bucketKey(date, granularity)
    const existing = grouped.get(key) || { ...ZERO_METRICS }
    grouped.set(key, mergeMetrics(existing, doc))
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, values]) => ({ label, values }))
}

export function sumMetrics(docs: MetricsDoc[]): MetricValues {
  return docs.reduce((acc, doc) => mergeMetrics(acc, doc), { ...ZERO_METRICS })
}

export function withDeltas(current: MetricValues, previous: MetricValues): MetricValues {
  return {
    netSales: current.netSales - previous.netSales,
    grossProfit: current.grossProfit - previous.grossProfit,
    marketingAdSpend: current.marketingAdSpend - previous.marketingAdSpend,
    mer: current.mer - previous.mer,
  }
}
