import { Button, Card, CardContent, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material'
import type { AppUserLike } from '@/lib/types'
import { getAnalyticsDefaultRange, getAnalyticsReport, getAnalyticsStoreOptions } from '@/lib/services/analytics'
import type { AnalyticsGranularity } from '@/lib/analytics-utils'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
}

function formatMetric(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
}

function metricDelta(current: number, previous: number): string {
  const delta = current - previous
  const prefix = delta >= 0 ? '+' : ''
  return `${prefix}${formatMetric(delta)}`
}

function normalizeDate(value?: string | string[]): string | undefined {
  if (!value) return undefined
  if (Array.isArray(value)) return value[0]
  return value
}

function chartPoints(values: number[], max: number, width: number, height: number): string {
  if (values.length === 0) return ''
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width
      const y = max <= 0 ? height : height - (value / max) * height
      return `${x},${y}`
    })
    .join(' ')
}

export async function AnalyticsPanel(props: {
  user: AppUserLike
  searchParams: Promise<Record<string, string | string[] | undefined>>
  title?: string
  description?: string
  basePath: string
  forcedAgencyId?: number
  forcedStoreId?: number
}) {
  const { user, title = 'Store Analytics', description = 'Shopify-only daily metrics with previous-period comparison.', basePath, forcedAgencyId, forcedStoreId } = props
  const params = await props.searchParams
  const fromParam = normalizeDate(params.from)
  const toParam = normalizeDate(params.to)
  const granularity = (normalizeDate(params.granularity) || 'day') as AnalyticsGranularity
  const storeIdRaw = forcedStoreId ? String(forcedStoreId) : normalizeDate(params.storeId)
  const parsedStoreId = storeIdRaw ? Number(storeIdRaw) : undefined
  const inputStoreId = Number.isFinite(parsedStoreId) ? parsedStoreId : undefined
  const [storeOptions, resolvedRange] = await Promise.all([
    getAnalyticsStoreOptions(user),
    fromParam && toParam
      ? Promise.resolve(null)
      : getAnalyticsDefaultRange(user, {
        agencyId: forcedAgencyId,
        storeId: inputStoreId,
      }),
  ])
  const from = fromParam || resolvedRange?.from || ''
  const to = toParam || resolvedRange?.to || ''
  const report = await getAnalyticsReport(user, {
    from,
    to,
    granularity,
    agencyId: forcedAgencyId,
    storeId: inputStoreId,
  })

  const currentSeries = report.buckets.map((bucket) => bucket.current.netSales)
  const previousSeries = report.buckets.map((bucket) => bucket.previous.netSales)
  const maxValue = Math.max(0, ...currentSeries, ...previousSeries)
  const chartWidth = 900
  const chartHeight = 220
  const currentPoints = chartPoints(currentSeries, maxValue, chartWidth, chartHeight)
  const previousPoints = chartPoints(previousSeries, maxValue, chartWidth, chartHeight)

  return (
    <Stack spacing={2}>
      <div>
        <Typography variant="h5">{title}</Typography>
        <Typography color="text.secondary">{description}</Typography>
      </div>

      <Card>
        <CardContent>
          <Stack component="form" method="GET" action={basePath} spacing={2}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField name="from" type="date" label="From" defaultValue={from} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField name="to" type="date" label="To" defaultValue={to} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField name="granularity" label="Granularity" defaultValue={granularity} select>
                  <MenuItem value="day">day</MenuItem>
                  <MenuItem value="week">week</MenuItem>
                  <MenuItem value="month">month</MenuItem>
                  <MenuItem value="year">year</MenuItem>
                </TextField>
              </Grid>
              {!forcedStoreId ? (
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField name="storeId" label="Store" defaultValue={inputStoreId ? String(inputStoreId) : ''} select>
                    <MenuItem value="">All visible stores</MenuItem>
                    {storeOptions.map((store) => (
                      <MenuItem key={store.id} value={store.id}>{store.name}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              ) : null}
            </Grid>
            <Stack direction="row" justifyContent="flex-end">
              <Button type="submit" variant="contained">Apply filters</Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        {[
          { key: 'Net sales', current: report.totalsCurrent.netSales, previous: report.totalsPrevious.netSales, formatter: formatCurrency },
          { key: 'Gross profit', current: report.totalsCurrent.grossProfit, previous: report.totalsPrevious.grossProfit, formatter: formatCurrency },
          { key: 'Marketing ad spend', current: report.totalsCurrent.marketingAdSpend, previous: report.totalsPrevious.marketingAdSpend, formatter: formatCurrency },
          { key: 'MER', current: report.totalsCurrent.mer, previous: report.totalsPrevious.mer, formatter: formatMetric },
        ].map((item) => (
          <Grid key={item.key} size={{ xs: 12, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>{item.key}</Typography>
                <Typography variant="h5">{item.formatter(item.current)}</Typography>
                <Typography color="text.secondary">Prev: {item.formatter(item.previous)} ({metricDelta(item.current, item.previous)})</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Net Sales Trend</Typography>
          {report.buckets.length === 0 ? (
            <Typography color="text.secondary">No rows found for the selected scope and date range.</Typography>
          ) : (
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: 260 }}>
              <polyline fill="none" stroke="#1565c0" strokeWidth="3" points={currentPoints} />
              <polyline fill="none" stroke="#00897b" strokeWidth="2" strokeDasharray="6 4" points={previousPoints} />
            </svg>
          )}
          <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
            <Typography variant="body2">Current period</Typography>
            <Typography variant="body2" color="text.secondary">Previous equal period</Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Bucket Breakdown</Typography>
          <Stack spacing={1}>
            {report.buckets.map((bucket, index) => (
              <Grid container spacing={1} key={`${bucket.currentLabel || 'c'}-${bucket.previousLabel || 'p'}-${index}`}>
                <Grid size={{ xs: 12, md: 2 }}>
                  <Typography fontWeight={700}>{bucket.currentLabel || '—'}</Typography>
                  <Typography color="text.secondary" variant="body2">Prev: {bucket.previousLabel || '—'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <Typography>{formatCurrency(bucket.current.netSales)}</Typography>
                  <Typography color="text.secondary" variant="body2">{formatCurrency(bucket.previous.netSales)}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <Typography>{formatCurrency(bucket.current.grossProfit)}</Typography>
                  <Typography color="text.secondary" variant="body2">{formatCurrency(bucket.previous.grossProfit)}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <Typography>{formatCurrency(bucket.current.marketingAdSpend)}</Typography>
                  <Typography color="text.secondary" variant="body2">{formatCurrency(bucket.previous.marketingAdSpend)}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <Typography>{formatMetric(bucket.current.mer)}</Typography>
                  <Typography color="text.secondary" variant="body2">{formatMetric(bucket.previous.mer)}</Typography>
                </Grid>
              </Grid>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
