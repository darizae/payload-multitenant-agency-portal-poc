import { notFound } from 'next/navigation'
import { Box, Button, Card, CardContent, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { requireUser } from '@/lib/auth'
import { getStorePageData } from '@/lib/services/portal'
import { createAssignment, createStoreMetric, createStoreUser } from '@/lib/actions/portal'
import { getAssignedStoreIdsForUser } from '@/lib/services/portal'
import { canManageStoreUsers, canWriteMetricsForStore } from '@/lib/rules'
import { isAgencyRoot, isStoreheroRole } from '@/lib/permissions'
import { AnalyticsPanel } from '@/components/dashboard/AnalyticsPanel'

export default async function StoreDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser()
  const { storeId } = await params
  const [data, assignedStoreIds] = await Promise.all([
    getStorePageData(user, storeId),
    getAssignedStoreIdsForUser(user),
  ])
  if (!data) notFound()

  const canCreateUsers = canManageStoreUsers({ user, store: data.store, assignedStoreIds })
  const canAssign = isStoreheroRole(user) || isAgencyRoot(user)
  const canCreateMetrics = canWriteMetricsForStore({ user, store: data.store, assignedStoreIds })

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4">{data.store.name}</Typography>
        <Typography color="text.secondary">Store-scoped workspace with user management, agency-user assignments, and analytics.</Typography>
      </div>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Store overview</Typography>
              <Stack spacing={1}>
                <Typography>Status: {data.store.status}</Typography>
                <Typography>Agency: {(data.store.agency as any)?.name || data.store.agency}</Typography>
                <Typography>Contact: {data.store.contactName || '—'}</Typography>
                <Typography>Email: {data.store.contactEmail || '—'}</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Counts</Typography>
              <Stack spacing={1}>
                <Typography>Store users: {data.storeUsers.length}</Typography>
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
            <Typography variant="h6" gutterBottom>Invite store user</Typography>
            <Stack component="form" action={createStoreUser} spacing={2}>
              <input type="hidden" name="storeId" value={storeId} />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}><TextField name="name" label="Name" required /></Grid>
                <Grid size={{ xs: 12, md: 4 }}><TextField name="email" label="Email" type="email" required /></Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField name="role" label="Role" select defaultValue="store-member">
                    <MenuItem value="store-root">store-root</MenuItem>
                    <MenuItem value="store-member">store-member</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
              <Stack direction="row" justifyContent="flex-end"><Button type="submit" variant="contained">Invite store user</Button></Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {canAssign ? (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Assign agency user</Typography>
            <Stack component="form" action={createAssignment} spacing={2}>
              <input type="hidden" name="storeId" value={storeId} />
              <TextField name="agencyUserId" label="Agency user" select defaultValue="" required>
                {data.agencyUsers.map((agencyUser: any) => (
                  <MenuItem key={agencyUser.id} value={agencyUser.id}>{agencyUser.name} · {agencyUser.role}</MenuItem>
                ))}
              </TextField>
              <Stack direction="row" justifyContent="flex-end"><Button type="submit" variant="contained">Assign user</Button></Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {canCreateMetrics ? (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Add metric entry</Typography>
            <Stack component="form" action={createStoreMetric} spacing={2}>
              <input type="hidden" name="tenantId" value={(data.store.agency as any)?.id || data.store.agency} />
              <input type="hidden" name="storeId" value={storeId} />
              <input type="hidden" name="returnPath" value={`/dashboard/stores/${storeId}`} />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}><TextField name="metricDate" label="Date" type="date" required InputLabelProps={{ shrink: true }} /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><TextField name="netSales" label="Net sales" type="number" required /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><TextField name="grossProfit" label="Gross profit" type="number" required /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><TextField name="marketingAdSpend" label="Marketing ad spend" type="number" required /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><TextField name="mer" label="MER" type="number" required /></Grid>
              </Grid>
              <Stack direction="row" justifyContent="flex-end"><Button type="submit" variant="contained">Save metric entry</Button></Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Store users</Typography>
              <Stack spacing={1.5}>
                {data.storeUsers.map((portalUser: any) => (
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

      <AnalyticsPanel
        user={user}
        searchParams={searchParams}
        title="Store Analytics"
        description="Store-scoped Shopify metrics grouped by selected granularity."
        basePath={`/dashboard/stores/${storeId}`}
        forcedStoreId={Number(storeId)}
      />
    </Stack>
  )
}
