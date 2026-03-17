import { notFound } from 'next/navigation'
import { Box, Button, Card, CardContent, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { requireUser } from '@/lib/auth'
import { getCustomerPageData } from '@/lib/services/portal'
import { createAssignment, createCustomerUser } from '@/lib/actions/portal'
import { getAssignedCustomerIdsForUser } from '@/lib/services/portal'
import { canManageCustomerUsers } from '@/lib/rules'
import { isPlatformAdmin, isAgencyAdmin } from '@/lib/permissions'

export default async function CustomerDetailPage({ params }: { params: Promise<{ customerId: string }> }) {
  const user = await requireUser()
  const { customerId } = await params
  const [data, assignedCustomerIds] = await Promise.all([
    getCustomerPageData(user, customerId),
    getAssignedCustomerIdsForUser(user),
  ])
  if (!data) notFound()

  const canCreateUsers = canManageCustomerUsers({ user, customer: data.customer, assignedCustomerIds })
  const canAssign = isPlatformAdmin(user) || isAgencyAdmin(user)

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4">{data.customer.name}</Typography>
        <Typography color="text.secondary">Customer-scoped workspace with user management and agency-user assignments.</Typography>
      </div>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Customer overview</Typography>
              <Stack spacing={1}>
                <Typography>Status: {data.customer.status}</Typography>
                <Typography>Agency: {(data.customer.agency as any)?.name || data.customer.agency}</Typography>
                <Typography>Contact: {data.customer.contactName || '—'}</Typography>
                <Typography>Email: {data.customer.contactEmail || '—'}</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Counts</Typography>
              <Stack spacing={1}>
                <Typography>Customer users: {data.customerUsers.length}</Typography>
                <Typography>Assigned agency users: {data.assignments.length}</Typography>
                <Typography>Outstanding invites: {data.invites.filter((invite: any) => invite.status === 'pending').length}</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {canCreateUsers ? (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Invite customer user</Typography>
            <Stack component="form" action={createCustomerUser} spacing={2}>
              <input type="hidden" name="customerId" value={customerId} />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}><TextField name="name" label="Name" required /></Grid>
                <Grid size={{ xs: 12, md: 4 }}><TextField name="email" label="Email" type="email" required /></Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField name="role" label="Role" select defaultValue="customer-user">
                    <MenuItem value="customer-admin">customer-admin</MenuItem>
                    <MenuItem value="customer-user">customer-user</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
              <Stack direction="row" justifyContent="flex-end"><Button type="submit" variant="contained">Invite customer user</Button></Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {canAssign ? (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Assign agency user</Typography>
            <Stack component="form" action={createAssignment} spacing={2}>
              <input type="hidden" name="customerId" value={customerId} />
              <TextField name="agencyUserId" label="Agency user" select defaultValue="">
                {data.agencyUsers.map((agencyUser: any) => (
                  <MenuItem key={agencyUser.id} value={agencyUser.id}>{agencyUser.name} · {agencyUser.role}</MenuItem>
                ))}
              </TextField>
              <Stack direction="row" justifyContent="flex-end"><Button type="submit" variant="contained">Assign user</Button></Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Customer users</Typography>
              <Stack spacing={1.5}>
                {data.customerUsers.map((portalUser: any) => (
                  <Box key={portalUser.id} sx={{ p: 2, border: '1px solid rgba(15,23,42,0.08)', borderRadius: 3 }}>
                    <Typography fontWeight={700}>{portalUser.name}</Typography>
                    <Typography color="text.secondary">{portalUser.email}</Typography>
                    <Typography color="text.secondary">{portalUser.role} · {portalUser.status}</Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Assigned agency users</Typography>
              <Stack spacing={1.5}>
                {data.assignments.map((assignment: any) => (
                  <Box key={assignment.id} sx={{ p: 2, border: '1px solid rgba(15,23,42,0.08)', borderRadius: 3 }}>
                    <Typography fontWeight={700}>{(assignment.agencyUser as any)?.name || assignment.assignmentLabel}</Typography>
                    <Typography color="text.secondary">{(assignment.agencyUser as any)?.email || 'Agency user'} · {assignment.status}</Typography>
                  </Box>
                ))}
                {data.assignments.length === 0 ? <Typography color="text.secondary">No agency users assigned yet.</Typography> : null}
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
