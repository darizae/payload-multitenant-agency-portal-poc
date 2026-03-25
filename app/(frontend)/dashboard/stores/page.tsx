import { Card, CardContent, Stack, Typography } from '@mui/material'
import { requireUser } from '@/lib/auth'
import { getVisibleStores } from '@/lib/services/portal'
import { LinkButton } from '@/components/mui/LinkButton'

export default async function StoresPage() {
  const user = await requireUser()
  const stores = await getVisibleStores(user)

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4">Stores</Typography>
        <Typography color="text.secondary">Stores visible within your current role and assignment scope.</Typography>
      </div>

      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            {stores.docs.map((store: any) => (
              <Stack key={store.id} direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ p: 2, border: '1px solid rgba(15,23,42,0.08)', borderRadius: 3 }}>
                <div>
                  <Typography fontWeight={700}>{store.name}</Typography>
                  <Typography color="text.secondary">Status: {store.status}</Typography>
                </div>
                <LinkButton href={`/dashboard/stores/${store.id}`} variant="outlined">Open store</LinkButton>
              </Stack>
            ))}
            {stores.docs.length === 0 ? <Typography color="text.secondary">No stores are visible in your scope.</Typography> : null}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
