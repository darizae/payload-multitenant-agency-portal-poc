import { notFound } from 'next/navigation'
import { Box, Button, Card, CardContent, Checkbox, FormControlLabel, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { requireUser } from '@/lib/auth'
import { getAgencyPageData } from '@/lib/services/portal'
import { createAgencyUser, createCustomer } from '@/lib/actions/portal'
import { canManageAgencyUsers, canManageCustomer } from '@/lib/rules'
import { LinkButton } from '@/components/mui/LinkButton'

export default async function AgencyDetailPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const user = await requireUser()
  const { agencyId } = await params
  const data = await getAgencyPageData(user, agencyId)
  if (!data) notFound()

  const canCreateAgencyUsers = canManageAgencyUsers(user)
  const canCreateCustomers = canManageCustomer(user)

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4">{data.agency.name}</Typography>
        <Typography color="text.secondary">Agency workspace, internal users, customers, assignments, and invite state.</Typography>
      </div>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Agency overview</Typography>
              <Stack spacing={1}>
                <Typography>Status: {data.agency.status}</Typography>
                <Typography>Primary contact: {data.agency.primaryContactName || '—'}</Typography>
                <Typography>Email: {data.agency.primaryContactEmail || '—'}</Typography>
                <Typography>Phone: {data.agency.primaryContactPhone || '—'}</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Counts</Typography>
              <Stack spacing={1}>
                <Typography>Agency users: {data.users.filter((user: any) => !user.customer).length}</Typography>
                <Typography>Customers: {data.customers.length}</Typography>
                <Typography>Assignments: {data.assignments.length}</Typography>
                <Typography>Outstanding invites: {data.invites.filter((invite: any) => invite.status === 'pending').length}</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {canCreateCustomers ? (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Create customer</Typography>
            <Stack component="form" action={createCustomer} spacing={2}>
              <input type="hidden" name="agencyId" value={agencyId} />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}><TextField name="name" label="Customer name" required /></Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField name="status" label="Status" defaultValue="active" select>
                    <MenuItem value="active">active</MenuItem>
                    <MenuItem value="inactive">inactive</MenuItem>
                    <MenuItem value="suspended">suspended</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}><TextField name="contactName" label="Contact name" /></Grid>
                <Grid size={{ xs: 12, md: 6 }}><TextField name="contactEmail" label="Contact email" type="email" /></Grid>
                <Grid size={{ xs: 12, md: 6 }}><TextField name="contactPhone" label="Contact phone" /></Grid>
              </Grid>
              <Stack direction="row" justifyContent="flex-end"><Button type="submit" variant="contained">Create customer</Button></Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {canCreateAgencyUsers ? (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Invite agency user</Typography>
            <Stack component="form" action={createAgencyUser} spacing={2}>
              <input type="hidden" name="agencyId" value={agencyId} />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}><TextField name="name" label="Name" required /></Grid>
                <Grid size={{ xs: 12, md: 4 }}><TextField name="email" label="Email" type="email" required /></Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField name="role" label="Role" select defaultValue="agency-user">
                    <MenuItem value="agency-admin">agency-admin</MenuItem>
                    <MenuItem value="agency-manager">agency-manager</MenuItem>
                    <MenuItem value="agency-user">agency-user</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
              <FormControlLabel control={<Checkbox name="hasGlobalCustomerAccess" />} label="Grant agency-wide customer visibility" />
              <Stack direction="row" justifyContent="flex-end"><Button type="submit" variant="contained">Invite agency user</Button></Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Customers</Typography>
              <Stack spacing={1.5}>
                {data.customers.map((customer: any) => (
                  <Stack key={customer.id} direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ p: 2, border: '1px solid rgba(15,23,42,0.08)', borderRadius: 3 }}>
                    <Box>
                      <Typography fontWeight={700}>{customer.name}</Typography>
                      <Typography color="text.secondary">{customer.status}</Typography>
                    </Box>
                    <LinkButton href={`/dashboard/customers/${customer.id}`} variant="outlined">Open</LinkButton>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Agency users</Typography>
              <Stack spacing={1.5}>
                {data.users.filter((user: any) => !user.customer).map((user: any) => (
                  <Box key={user.id} sx={{ p: 2, border: '1px solid rgba(15,23,42,0.08)', borderRadius: 3 }}>
                    <Typography fontWeight={700}>{user.name}</Typography>
                    <Typography color="text.secondary">{user.email}</Typography>
                    <Typography color="text.secondary">{user.role} · {user.status}</Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Latest invites</Typography>
          <Stack spacing={1.5}>
            {data.invites.slice(0, 10).map((invite: any) => (
              <Box key={invite.id} sx={{ p: 2, border: '1px solid rgba(15,23,42,0.08)', borderRadius: 3 }}>
                <Typography fontWeight={700}>{invite.email}</Typography>
                <Typography color="text.secondary">{invite.status} · token: /activate-invite/{invite.token}</Typography>
              </Box>
            ))}
            {data.invites.length === 0 ? <Typography color="text.secondary">No invites issued yet.</Typography> : null}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
