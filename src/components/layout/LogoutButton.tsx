'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@mui/material'

export function LogoutButton() {
  const router = useRouter()

  return (
    <Button
      variant="outlined"
      onClick={async () => {
        await fetch('/api/users/logout', {
          method: 'POST',
          credentials: 'include',
        })
        router.push('/login')
        router.refresh()
      }}
    >
      Log out
    </Button>
  )
}
