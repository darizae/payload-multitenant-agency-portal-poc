import { NextResponse } from 'next/server'
import { generateExpiredPayloadCookie } from 'payload'
import { getPayloadClient } from '@/lib/payload'

function normalizeSameSite(sameSite?: 'Lax' | 'None' | 'Strict') {
  if (!sameSite) return 'lax' as const
  const lower = sameSite.toLowerCase()
  if (lower === 'lax' || lower === 'strict' || lower === 'none') return lower
  return 'lax' as const
}

export async function POST(req: Request) {
  const payload = await getPayloadClient() as any
  const authConfig = payload.collections?.users?.config?.auth
  const response = NextResponse.redirect(new URL('/login', req.url), { status: 303 })

  if (!authConfig || typeof authConfig !== 'object') {
    response.cookies.delete('payload-token')
    return response
  }

  const expiredCookie = generateExpiredPayloadCookie({
    collectionAuthConfig: authConfig,
    cookiePrefix: payload.config.cookiePrefix || 'payload',
    returnCookieAsObject: true,
  })

  response.cookies.set({
    name: expiredCookie.name,
    value: expiredCookie.value || '',
    domain: expiredCookie.domain,
    expires: expiredCookie.expires ? new Date(expiredCookie.expires) : undefined,
    httpOnly: expiredCookie.httpOnly,
    maxAge: expiredCookie.maxAge,
    path: expiredCookie.path || '/',
    sameSite: normalizeSameSite(expiredCookie.sameSite),
    secure: expiredCookie.secure,
  })

  return response
}
