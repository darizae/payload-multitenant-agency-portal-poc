'use client'

import * as React from 'react'
import { ThemeProvider, createTheme } from '@mui/material'

export function TenantThemeProvider(props: {
  branding: {
    primaryColor?: string | null
    secondaryColor?: string | null
  } | null
  children: React.ReactNode
}) {
  const { branding, children } = props
  const tenantTheme = React.useMemo(() => {
    if (!branding?.primaryColor && !branding?.secondaryColor) {
      return null
    }

    return createTheme({
      palette: {
        primary: {
          main: branding.primaryColor || '#1565c0',
        },
        secondary: {
          main: branding.secondaryColor || '#00897b',
        },
      },
    })
  }, [branding?.primaryColor, branding?.secondaryColor])

  if (!tenantTheme) {
    return <>{children}</>
  }

  return <ThemeProvider theme={tenantTheme}>{children}</ThemeProvider>
}
