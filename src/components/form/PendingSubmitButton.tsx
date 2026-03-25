'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@mui/material'

type PendingSubmitButtonProps = {
  label: string
  pendingLabel: string
  pending?: boolean
  variant?: 'text' | 'outlined' | 'contained'
}

export function PendingSubmitButton({
  label,
  pendingLabel,
  pending = false,
  variant = 'contained',
}: PendingSubmitButtonProps) {
  const { pending: formPending } = useFormStatus()
  const isPending = pending || formPending
  return (
    <Button type="submit" variant={variant} disabled={isPending}>
      {isPending ? pendingLabel : label}
    </Button>
  )
}
