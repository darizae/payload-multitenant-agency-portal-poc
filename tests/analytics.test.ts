import { describe, expect, it } from 'vitest'
import { aggregateByBucket, bucketKey, startOfDayUTC, withDeltas } from '@/lib/analytics-utils'

describe('analytics service helpers', () => {
  it('builds bucket keys for all supported granularities', () => {
    const day = new Date('2025-01-14T12:45:00Z')
    expect(bucketKey(day, 'day')).toBe('2025-01-14')
    expect(bucketKey(day, 'week')).toBe('2025-W03')
    expect(bucketKey(day, 'month')).toBe('2025-01')
    expect(bucketKey(day, 'year')).toBe('2025')
  })

  it('aggregates rows into monthly buckets', () => {
    const buckets = aggregateByBucket(
      [
        { metricDate: '2025-01-02', netSales: 10, grossProfit: 5, marketingAdSpend: 2, mer: 4 },
        { metricDate: '2025-01-20', netSales: 20, grossProfit: 8, marketingAdSpend: 5, mer: 5 },
        { metricDate: '2025-02-01', netSales: 15, grossProfit: 7, marketingAdSpend: 3, mer: 5 },
      ],
      'month',
    )

    expect(buckets).toHaveLength(2)
    expect(buckets[0].label).toBe('2025-01')
    expect(buckets[0].values.netSales).toBe(30)
    expect(buckets[1].label).toBe('2025-02')
    expect(buckets[1].values.netSales).toBe(15)
  })

  it('computes deltas between current and previous periods', () => {
    expect(
      withDeltas(
        { netSales: 100, grossProfit: 40, marketingAdSpend: 20, mer: 4 },
        { netSales: 80, grossProfit: 30, marketingAdSpend: 18, mer: 3.5 },
      ),
    ).toEqual({
      netSales: 20,
      grossProfit: 10,
      marketingAdSpend: 2,
      mer: 0.5,
    })
  })

  it('normalizes date to UTC day boundaries', () => {
    const normalized = startOfDayUTC(new Date('2025-03-01T23:59:59Z'))
    expect(normalized.toISOString()).toBe('2025-03-01T00:00:00.000Z')
  })
})
