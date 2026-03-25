import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getId } from '@/lib/utils'

export default async function DashboardPage() {
  const user = await requireUser()
  if (user.role === 'storehero-root' || user.role === 'storehero-member') {
    redirect('/dashboard/storehero')
  }
  if (user.role === 'agency-root' || user.role === 'agency-member') {
    const agencyId = getId(user.agency)
    if (agencyId) {
      redirect(`/dashboard/agencies/${agencyId}`)
    }
    redirect('/dashboard/agencies')
  }

  const storeId = getId(user.store)
  if (storeId) {
    redirect(`/dashboard/stores/${storeId}`)
  }
  redirect('/login')
}
