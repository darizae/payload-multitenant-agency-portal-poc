'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@mui/material'

type LinkButtonProps = {
  href: string
  children: ReactNode
  [key: string]: any
}

export function LinkButton({ href, children, ...props }: LinkButtonProps) {
  return (
    <Button component={Link as any} href={href} {...props}>{children}</Button>
  )
}
