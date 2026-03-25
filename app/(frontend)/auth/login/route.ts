import { NextResponse } from 'next/server'
import { generatePayloadCookie } from 'payload'
import { getPayloadClient } from '@/lib/payload'
import { isUserRole } from '@/lib/login-routes'

function text(formData: FormData, key: string): string {
  return String(formData.get(key) || '').trim()
}

function normalizeLoginPath(path: string): string {
  if (!path || !path.startsWith('/login')) return '/login'
  return path
}

function normalizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || 'Login failed.')
  if (message.toLowerCase().includes('error initializing payload')) {
    return 'Authentication backend is unavailable. Start Postgres and try again.'
  }
  if (message.includes('Failed query:') || message.toLowerCase().includes('lock timeout')) {
    return 'Authentication is temporarily unavailable. Try signing in again.'
  }
  return message || 'Login failed.'
}

function normalizeSameSite(sameSite?: 'Lax' | 'None' | 'Strict') {
  if (!sameSite) return 'lax' as const
  const lower = sameSite.toLowerCase()
  if (lower === 'lax' || lower === 'strict' || lower === 'none') return lower
  return 'lax' as const
}

function redirectToLogin(req: Request, params: { loginPath: string; error: string; email?: string }) {
  const url = new URL(params.loginPath, req.url)
  url.searchParams.set('error', params.error)
  if (params.email) {
    url.searchParams.set('email', params.email)
  }
  return NextResponse.redirect(url, { status: 303 })
}

export async function POST(req: Request) {
  const formData = await req.formData()
  const email = text(formData, 'email').toLowerCase()
  const password = text(formData, 'password')
  const loginPath = normalizeLoginPath(text(formData, 'loginPath'))
  const expectedRoleRaw = text(formData, 'expectedRole')
  const expectedRole = isUserRole(expectedRoleRaw) ? expectedRoleRaw : undefined

  if (!email || !password) {
    return redirectToLogin(req, { loginPath, error: 'Email and password are required.', email })
  }

  try {
    const payload = await getPayloadClient() as any
    const result = await payload.login({
      collection: 'users',
      depth: 0,
      data: { email, password },
    })

    const user = result?.user
    const token = result?.token
    const role = String(user?.role || '')
    if (!user || !token) {
      return redirectToLogin(req, { loginPath, error: 'Login failed.', email })
    }

    if (expectedRole && role !== expectedRole) {
      return redirectToLogin(req, {
        loginPath,
        error: `This login is restricted to ${expectedRole}. Your account role is ${role || 'unknown'}.`,
        email,
      })
    }

    const authConfig = payload.collections?.users?.config?.auth
    if (!authConfig || typeof authConfig !== 'object') {
      return redirectToLogin(req, { loginPath, error: 'Auth configuration for users collection is missing.', email })
    }

    const cookie = generatePayloadCookie({
      collectionAuthConfig: authConfig,
      cookiePrefix: payload.config.cookiePrefix || 'payload',
      returnCookieAsObject: true,
      token,
    })

    const response = NextResponse.redirect(new URL('/dashboard', req.url), { status: 303 })
    response.cookies.set({
      name: cookie.name,
      value: cookie.value || '',
      domain: cookie.domain,
      expires: cookie.expires ? new Date(cookie.expires) : undefined,
      httpOnly: cookie.httpOnly,
      maxAge: cookie.maxAge,
      path: cookie.path || '/',
      sameSite: normalizeSameSite(cookie.sameSite),
      secure: cookie.secure,
    })
    return response
  } catch (error) {
    return redirectToLogin(req, { loginPath, error: normalizeErrorMessage(error), email })
  }
}
