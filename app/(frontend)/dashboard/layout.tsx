import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { requireUser } from '@/lib/auth'
import { getAgencyBrandingForUser } from '@/features/portal/shared/services'
import { TenantThemeProvider } from '@/components/mui/TenantThemeProvider'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser()
  const branding = await getAgencyBrandingForUser(user)
  return (
    <TenantThemeProvider branding={branding}>
      <AppShell user={user}>{children}</AppShell>
    </TenantThemeProvider>
  )
}
