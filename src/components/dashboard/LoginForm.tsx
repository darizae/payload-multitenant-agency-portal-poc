'use client'

import { useState } from 'react'
import { Alert, Box, Card, CardContent, Stack, TextField, Typography } from '@mui/material'
import type { UserRole } from '@/lib/constants'
import { PendingSubmitButton } from '@/components/form/PendingSubmitButton'

type LoginFormProps = {
  title?: string
  description?: string
  expectedRole?: UserRole
  demoEmail?: string
  loginPath?: string
  error?: string | null
  activated?: boolean
  email?: string | null
}

export function LoginForm({
  title = 'Sign in',
  description = 'Use one of the seeded demo accounts or an invited account you activated.',
  expectedRole,
  demoEmail = 'storehero.root@poc.local',
  loginPath = '/login',
  error = null,
  activated = false,
  email = null,
}: LoginFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <Card sx={{ maxWidth: 460, width: '100%' }}>
      <CardContent sx={{ p: 4 }}>
        <Stack spacing={2.5} component="form" action="/auth/login" method="post" onSubmit={() => setIsSubmitting(true)}>
          <Box>
            <Typography variant="h4" gutterBottom>
              {title}
            </Typography>
            <Typography color="text.secondary">
              {description}
            </Typography>
          </Box>
          <input type="hidden" name="loginPath" value={loginPath} />
          {expectedRole ? <input type="hidden" name="expectedRole" value={expectedRole} /> : null}
          {activated ? <Alert severity="success">Invite activated. You can sign in now.</Alert> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField
            name="email"
            type="email"
            label="Email"
            required
            autoComplete="email"
            defaultValue={email || ''}
          />
          <TextField
            name="password"
            type="password"
            label="Password"
            required
            autoComplete="current-password"
          />
          <PendingSubmitButton label="Sign in" pendingLabel="Signing in…" pending={isSubmitting} />
          <Alert severity="info">
            Seeded demo login: {demoEmail} / Passw0rd!Demo
          </Alert>
        </Stack>
      </CardContent>
    </Card>
  )
}
