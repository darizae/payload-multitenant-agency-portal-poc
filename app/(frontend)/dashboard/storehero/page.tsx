import { Card, CardContent, Grid, Stack, Typography } from '@mui/material'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getDashboardStats, getVisibleAgencies, getVisibleStores } from '@/lib/services/portal'
import { LinkButton } from '@/components/mui/LinkButton'
import { AnalyticsPanel } from '@/components/dashboard/AnalyticsPanel'

export default async function StoreheroDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser()
  if (user.role !== 'storehero-root' && user.role !== 'storehero-member') {
    redirect('/dashboard')
  }
  const [stats, agencies, stores] = await Promise.all([
    getDashboardStats(user),
    getVisibleAgencies(user),
    getVisibleStores(user),
  ])

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4">Storehero Dashboard</Typography>
        <Typography color="text.secondary">Cross-tenant operator workspace.</Typography>
      </div>

      <Grid container spacing={2}>
        {[
          ['Visible agencies', stats.agencies],
          ['Visible stores', stats.stores],
          ['Visible users', stats.users],
        ].map(([label, value]) => (
          <Grid key={String(label)} size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>{label}</Typography>
                <Typography variant="h4">{value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Agencies</Typography>
              <Stack spacing={1.5}>
                {agencies.docs.map((agency: any) => (
                  <Stack key={agency.id} direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ p: 2, border: '1px solid rgba(15,23,42,0.08)', borderRadius: 3 }}>
                    <div>
                      <Typography fontWeight={700}>{agency.name}</Typography>
                      <Typography color="text.secondary">Status: {agency.status}</Typography>
                    </div>
                    <LinkButton href={`/dashboard/agencies/${agency.id}`} variant="outlined">Open</LinkButton>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Stores</Typography>
              <Stack spacing={1.5}>
                {stores.docs.slice(0, 25).map((store: any) => (
                  <Stack key={store.id} direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ p: 2, border: '1px solid rgba(15,23,42,0.08)', borderRadius: 3 }}>
                    <div>
                      <Typography fontWeight={700}>{store.name}</Typography>
                      <Typography color="text.secondary">Status: {store.status}</Typography>
                    </div>
                    <LinkButton href={`/dashboard/stores/${store.id}`} variant="outlined">Open</LinkButton>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <AnalyticsPanel
        user={user}
        searchParams={searchParams}
        title="Cross-Agency Analytics"
        description="Shopify metrics across all visible agencies and stores."
        basePath="/dashboard/storehero"
      />
    </Stack>
  )
}
