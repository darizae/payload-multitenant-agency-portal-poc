import { Button, Card, CardContent, Grid, Stack, TextField, Typography } from '@mui/material'
import { requireUser } from '@/lib/auth'
import { getVisibleAgencies } from '@/lib/services/portal'
import { createAgency } from '@/lib/actions/portal'
import { isPlatformAdmin } from '@/lib/permissions'
import { LinkButton } from '@/components/mui/LinkButton'

export default async function AgenciesPage() {
  const user = await requireUser()
  const agencies = await getVisibleAgencies(user)

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4">Agencies</Typography>
        <Typography color="text.secondary">Top-level tenants. Platform admins can create new agencies here.</Typography>
      </div>

      {isPlatformAdmin(user) ? (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Create agency</Typography>
            <Stack component="form" action={createAgency} spacing={2}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}><TextField name="name" label="Agency name" required /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><TextField name="status" label="Status" defaultValue="active" /></Grid>
                <Grid size={{ xs: 12, md: 6 }}><TextField name="primaryContactName" label="Primary contact" /></Grid>
                <Grid size={{ xs: 12, md: 6 }}><TextField name="primaryContactEmail" label="Primary contact email" type="email" /></Grid>
                <Grid size={{ xs: 12, md: 6 }}><TextField name="primaryContactPhone" label="Primary contact phone" /></Grid>
              </Grid>
              <Stack direction="row" justifyContent="flex-end"><Button type="submit" variant="contained">Create agency</Button></Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            {agencies.docs.map((agency: any) => (
              <Stack key={agency.id} direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ p: 2, border: '1px solid rgba(15,23,42,0.08)', borderRadius: 3 }}>
                <div>
                  <Typography fontWeight={700}>{agency.name}</Typography>
                  <Typography color="text.secondary">Status: {agency.status}</Typography>
                </div>
                <LinkButton href={`/dashboard/agencies/${agency.id}`} variant="outlined">Open agency</LinkButton>
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
