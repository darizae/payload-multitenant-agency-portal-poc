import { Box, Container, Stack } from '@mui/material'
import { LoginForm } from '@/components/dashboard/LoginForm'
import { LinkButton } from '@/components/mui/LinkButton'
import { getRoleLoginConfigs } from '@/lib/login-routes'

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const error = firstValue(query.error)
  const email = firstValue(query.email)
  const activated = firstValue(query.activated) === '1'
  const roleConfigs = getRoleLoginConfigs()

  return (
    <Container maxWidth="sm">
      <Stack spacing={3} sx={{ minHeight: '100vh', justifyContent: 'center', py: 6 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {roleConfigs.map((config) => (
            <LinkButton key={config.role} href={`/login/${config.role}`} variant="outlined" size="small">
              {config.label}
            </LinkButton>
          ))}
        </Box>
        <LoginForm error={error} email={email} activated={activated} />
      </Stack>
    </Container>
  )
}
