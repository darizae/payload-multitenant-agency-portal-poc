import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import { canAccessPayloadAdmin } from '@/lib/permissions'
import type { AppUserLike } from '@/lib/types'

export async function getCurrentUser(): Promise<AppUserLike | null> {
  const payload = await getPayloadClient()
  const token = (await cookies()).get('payload-token')?.value
  if (!token) {
    return null
  }
  const result = await payload.auth({
    headers: new Headers({
      authorization: `Bearer ${token}`,
    }),
  })
  return (result?.user as AppUserLike | null | undefined) ?? null
}

export async function requireUser(): Promise<AppUserLike> {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  return user
}

export async function requirePayloadAdminUser(): Promise<AppUserLike> {
  const user = await requireUser()
  if (!canAccessPayloadAdmin(user)) {
    redirect('/dashboard')
  }
  return user
}
