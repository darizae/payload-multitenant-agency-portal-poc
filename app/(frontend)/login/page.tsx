import { Suspense } from 'react'
import { Box, Container } from '@mui/material'
import { LoginForm } from '@/components/dashboard/LoginForm'

export default function LoginPage() {
  return (
    <Container maxWidth="sm">
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', py: 6 }}>
        <Suspense>
          <LoginForm />
        </Suspense>
      </Box>
    </Container>
  )
}
