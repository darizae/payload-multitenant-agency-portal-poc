import { Button, Card, CardContent, Grid, Stack, Typography } from '@mui/material'
import { requireUser } from '@/lib/auth'
import { getDashboardStats, getVisibleCustomers } from '@/lib/services/portal'
import { LinkButton } from '@/components/mui/LinkButton'

export default async function DashboardPage() {
  const user = await requireUser()
  const [stats, customers] = await Promise.all([getDashboardStats(user), getVisibleCustomers(user)])

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
        <div>
          <Typography variant="h4">Dashboard</Typography>
        </div>
        <Stack direction="row" spacing={1}>
          <LinkButton href="/dashboard/agencies" variant="contained">Browse agencies</LinkButton>
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        {[
          ['Visible agencies', stats.agencies],
          ['Visible customers', stats.customers],
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

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Visible customer workspaces</Typography>
          <Stack spacing={1.5}>
            {customers.docs.map((customer: any) => (
              <Stack
                key={customer.id}
                direction={{ xs: 'column', md: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', md: 'center' }}
                sx={{ p: 2, border: '1px solid rgba(15,23,42,0.08)', borderRadius: 3 }}
              >
                <div>
                  <Typography fontWeight={700}>{customer.name}</Typography>
                  <Typography color="text.secondary">Status: {customer.status}</Typography>
                </div>
                <LinkButton href={`/dashboard/customers/${customer.id}`} variant="outlined">Open customer</LinkButton>
              </Stack>
            ))}
            {customers.docs.length === 0 ? (
              <Typography color="text.secondary">No customers are visible in your current scope.</Typography>
            ) : null}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
