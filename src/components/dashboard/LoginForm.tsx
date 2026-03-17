'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const activated = searchParams.get('activated') === '1'

  return (
    <Card sx={{ maxWidth: 460, width: '100%' }}>
      <CardContent sx={{ p: 4 }}>
        <Stack spacing={2.5} component="form" onSubmit={async (event) => {
          event.preventDefault()
          setLoading(true)
          setError(null)

          const formData = new FormData(event.currentTarget)
          const response = await fetch('/api/users/login', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: String(formData.get('email') || '').trim(),
              password: String(formData.get('password') || ''),
            }),
          })

          const payload = await response.json().catch(() => ({}))
          if (!response.ok) {
            const nextError = payload?.errors?.[0]?.message || payload?.message || 'Login failed.'
            setError(nextError)
            setLoading(false)
            return
          }

          router.push('/dashboard')
          router.refresh()
        }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              Sign in
            </Typography>
            <Typography color="text.secondary">
              Use one of the seeded demo accounts or an invited account you activated.
            </Typography>
          </Box>
          {activated ? <Alert severity="success">Invite activated. You can sign in now.</Alert> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField name="email" type="email" label="Email" required autoComplete="email" />
          <TextField name="password" type="password" label="Password" required autoComplete="current-password" />
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
          <Alert severity="info">
            Seeded demo login: platform.admin@poc.local / Passw0rd!Demo
          </Alert>
        </Stack>
      </CardContent>
    </Card>
  )
}
