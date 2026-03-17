import { notFound } from 'next/navigation'
import { Alert, Box, Button, Card, CardContent, Container, Stack, TextField, Typography } from '@mui/material'
import { activateInvite } from '@/lib/actions/portal'
import { getPayloadClient } from '@/lib/payload'

export default async function ActivateInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const payload = await getPayloadClient()
  const invites = await payload.find({
    collection: 'invite-tokens',
    overrideAccess: true,
    depth: 1,
    limit: 1,
    where: { token: { equals: token } },
  })

  const invite = invites.docs[0]
  if (!invite) notFound()

  const expired = new Date(invite.expiresAt).getTime() < Date.now() || invite.status !== 'pending'

  return (
    <Container maxWidth="sm">
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', py: 6 }}>
        <Card sx={{ width: '100%', maxWidth: 520 }}>
          <CardContent sx={{ p: 4 }}>
            <Stack spacing={2.5} component="form" action={activateInvite}>
              <div>
                <Typography variant="h4" gutterBottom>Activate invite</Typography>
                <Typography color="text.secondary">{invite.email}</Typography>
              </div>
              {expired ? (
                <Alert severity="error">This invite is expired or already used.</Alert>
              ) : (
                <Alert severity="info">Set a password to activate the account and finish the invite flow.</Alert>
              )}
              <input type="hidden" name="token" value={token} />
              <TextField name="password" type="password" label="Password" required disabled={expired} />
              <TextField name="passwordConfirm" type="password" label="Confirm password" required disabled={expired} />
              <Button type="submit" variant="contained" disabled={expired}>Activate account</Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Container>
  )
}
