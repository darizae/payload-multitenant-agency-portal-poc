import type { ReactNode } from 'react'
import Link from 'next/link'
import { AppBar, Box, Button, Chip, Container, Stack, Toolbar, Typography } from '@mui/material'
import type { AppUserLike } from '@/lib/types'
import { LogoutButton } from '@/components/layout/LogoutButton'
import { canAccessPayloadAdmin } from '@/lib/permissions'

export function AppShell({ user, children }: { user: AppUserLike; children: ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
        <Toolbar sx={{ gap: 2, minHeight: 72 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Agency Portal POC
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Button component={Link} href="/dashboard">Dashboard</Button>
            <Button component={Link} href="/dashboard/agencies">Agencies</Button>
            {canAccessPayloadAdmin(user) ? (
              <Button component={Link} href="/admin" variant="outlined">Payload Admin</Button>
            ) : null}
            <Chip label={`${user.name || user.email} · ${user.role}`} color="primary" variant="outlined" />
            <LogoutButton />
          </Stack>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {children}
      </Container>
    </Box>
  )
}
