'use client'

import { useState } from 'react'
import { PendingSubmitButton } from '@/components/form/PendingSubmitButton'

export function LogoutButton() {
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <form action="/auth/logout" method="post" onSubmit={() => setIsSubmitting(true)}>
      <PendingSubmitButton label="Log out" pendingLabel="Logging out…" pending={isSubmitting} variant="outlined" />
    </form>
  )
}
