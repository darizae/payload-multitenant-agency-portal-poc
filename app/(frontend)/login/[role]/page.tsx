import { notFound } from 'next/navigation'
import { Box, Container, Stack } from '@mui/material'
import { LoginForm } from '@/components/dashboard/LoginForm'
import { LinkButton } from '@/components/mui/LinkButton'
import { getRoleLoginConfig, getRoleLoginConfigs } from '@/lib/login-routes'

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export default async function RoleLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { role } = await params
  const query = await searchParams
  const error = firstValue(query.error)
  const email = firstValue(query.email)
  const activated = firstValue(query.activated) === '1'
  const loginConfig = getRoleLoginConfig(role)
  if (!loginConfig) {
    notFound()
  }

  const allRoleConfigs = getRoleLoginConfigs()

  return (
    <Container maxWidth="sm">
      <Stack spacing={3} sx={{ minHeight: '100vh', justifyContent: 'center', py: 6 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <LinkButton href="/login" variant="text" size="small">
            Generic login
          </LinkButton>
          {allRoleConfigs.map((config) => (
            <LinkButton
              key={config.role}
              href={`/login/${config.role}`}
              variant={config.role === loginConfig.role ? 'contained' : 'outlined'}
              size="small"
            >
              {config.label}
            </LinkButton>
          ))}
        </Box>
        <LoginForm
          title={`${loginConfig.label} sign in`}
          description={loginConfig.description}
          expectedRole={loginConfig.role}
          demoEmail={loginConfig.demoEmail}
          loginPath={`/login/${loginConfig.role}`}
          error={error}
          email={email}
          activated={activated}
        />
      </Stack>
    </Container>
  )
}
