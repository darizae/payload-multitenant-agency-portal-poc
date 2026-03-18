import type { ReactNode } from 'react'
import './globals.css'
import { AppThemeProvider } from '@/components/mui/AppThemeProvider'

export default function FrontendLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppThemeProvider>{children}</AppThemeProvider>
      </body>
    </html>
  )
}
