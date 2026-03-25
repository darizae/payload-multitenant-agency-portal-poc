import { notFound } from 'next/navigation'
import { Box, Button, Card, CardContent, Checkbox, FormControlLabel, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { requireUser } from '@/lib/auth'
import { getAgencyPageData } from '@/features/portal/agency/services'
import { getAssignedStoreIdsForUser } from '@/features/portal/shared/services'
import { createAgencyUser, createStore } from '@/features/portal/agency/actions'
import { createStoreMetric } from '@/features/portal/store/actions'
import { canManageAgencyUsers, canManageStore, canWriteMetricsForStore } from '@/authz/ui-rules'
import { LinkButton } from '@/components/mui/LinkButton'
import { AnalyticsPanel } from '@/components/dashboard/AnalyticsPanel'

export default async function AgencyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencyId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser()
  const { agencyId } = await params
  const data = await getAgencyPageData(user, agencyId)
  if (!data) notFound()
  const assignedStoreIds = await getAssignedStoreIdsForUser(user)

  const canCreateAgencyUsers = canManageAgencyUsers(user)
  const canCreateStores = canManageStore(user)
  const writableStores = data.stores.filter((store: any) =>
    canWriteMetricsForStore({ user, store, assignedStoreIds }),
  )

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4">{data.agency.name}</Typography>
        <Typography color="text.secondary">Agency workspace, internal users, stores, assignments, invite state, and metrics.</Typography>
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
                <Typography>Agency users: {data.users.filter((portalUser: any) => !portalUser.store).length}</Typography>
                <Typography>Stores: {data.stores.length}</Typography>
                <Typography>Assignments: {data.assignments.length}</Typography>
                <Typography>Outstanding invites: {data.invites.filter((invite: any) => invite.status === 'pending').length}</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {canCreateStores ? (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Create store</Typography>
            <Stack component="form" action={createStore} spacing={2}>
              <input type="hidden" name="agencyId" value={agencyId} />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}><TextField name="name" label="Store name" required /></Grid>
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
              <Stack direction="row" justifyContent="flex-end"><Button type="submit" variant="contained">Create store</Button></Stack>
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
                  <TextField name="role" label="Role" select defaultValue="agency-member">
                    <MenuItem value="agency-root">agency-root</MenuItem>
                    <MenuItem value="agency-member">agency-member</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
              <FormControlLabel control={<Checkbox name="hasGlobalStoreAccess" />} label="Grant agency-wide store visibility" />
              <Stack direction="row" justifyContent="flex-end"><Button type="submit" variant="contained">Invite agency user</Button></Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {writableStores.length > 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Add metric entry</Typography>
            <Stack component="form" action={createStoreMetric} spacing={2}>
              <input type="hidden" name="tenantId" value={agencyId} />
              <input type="hidden" name="returnPath" value={`/dashboard/agencies/${agencyId}`} />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField name="storeId" label="Store" select defaultValue={String(writableStores[0].id)} required>
                    {writableStores.map((store: any) => (
                      <MenuItem key={store.id} value={store.id}>{store.name}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
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
              <Typography variant="h6" gutterBottom>Stores</Typography>
              <Stack spacing={1.5}>
                {data.stores.map((store: any) => (
                  <Stack key={store.id} direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ p: 2, border: '1px solid rgba(15,23,42,0.08)', borderRadius: 3 }}>
                    <Box>
                      <Typography fontWeight={700}>{store.name}</Typography>
                      <Typography color="text.secondary">{store.status}</Typography>
                    </Box>
                    <LinkButton href={`/dashboard/stores/${store.id}`} variant="outlined">Open</LinkButton>
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
                {data.users.filter((portalUser: any) => !portalUser.store).map((portalUser: any) => (
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
        title="Agency Analytics"
        description="Tenant-scoped Shopify metrics grouped by selected granularity."
        basePath={`/dashboard/agencies/${agencyId}`}
        forcedAgencyId={Number(agencyId)}
      />
    </Stack>
  )
}
