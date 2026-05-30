import { OAuth2Client } from 'google-auth-library'
import { createSessionToken } from '../../lib/session'
import { Employee } from '../../models/Employee'
// POST /api/auth/google — verify Google credential and create a session
import { connectDB } from '../../utils/mongoose'
import { rateLimit } from '../../utils/rateLimit'
import { logger } from '../../utils/logger'
const log = logger('[google.post]')

/**
 * A1 fix: require GOOGLE_CLIENT_ID unconditionally at module load time.
 *
 * Previously the audience check was guarded by `if (clientId && ...)` which
 * meant any token was accepted when GOOGLE_CLIENT_ID was not set — a full
 * authentication bypass. Now the server refuses to start without it.
 */
const GOOGLE_CLIENT_ID = (() => {
  const id = process.env.GOOGLE_CLIENT_ID
  if (!id || id.trim() === '') {
    throw new Error(
      'FATAL: GOOGLE_CLIENT_ID environment variable is not set. '
      + 'Configure it in .env from https://console.cloud.google.com/apis/credentials',
    )
  }
  return id
})()

// Re-use a single OAuth2Client instance (avoids re-creating on every request)
const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID)

/**
 * A1 fix: use google-auth-library's verifyIdToken() instead of a manual
 * tokeninfo HTTP fetch. Benefits:
 *  - Verifies the token's signature using Google's public JWKS (not just a
 *    server round-trip that could be MITMed).
 *  - Enforces audience (aud) check unconditionally — cannot be bypassed by
 *    leaving GOOGLE_CLIENT_ID unset.
 *  - Handles clock skew and token expiry internally.
 *  - Caches public keys so repeated logins don't each fetch JWKS.
 */
async function verifyGoogleToken(credential: string): Promise<{
  email: string
  name: string
  picture: string
  sub: string
}> {
  const ticket = await oauthClient.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID,
  })
  const payload = ticket.getPayload()
  if (!payload?.email)
    throw new Error('Google token missing email claim')

  return {
    email: payload.email,
    name: payload.name ?? payload.email,
    picture: payload.picture ?? '',
    sub: payload.sub,
  }
}

export default defineEventHandler(async (event) => {
  // H3: 10 login attempts per minute per IP — brute-force protection
  rateLimit(event, { max: 10, windowMs: 60_000, key: `login:${event.node.req.socket?.remoteAddress ?? 'unknown'}` })
  await connectDB()

  if (event.method !== 'POST')
    throw createError({ statusCode: 405, message: 'Method not allowed' })

  const body = await readBody(event)
  const { credential } = body

  if (!credential)
    throw createError({ statusCode: 400, message: 'Google credential token is required' })

  // 1. Verify Google token (signature + audience + expiry — all enforced)
  let googleUser: { email: string, name: string, picture: string, sub: string }
  try {
    googleUser = await verifyGoogleToken(credential)
  }
  catch (e: any) {
    throw createError({ statusCode: 401, message: `Invalid Google token: ${e?.message || 'verification failed'}` })
  }

  // 2. Check employee exists
  const employee = await Employee.findOne({ email: googleUser.email.toLowerCase() }).lean<any>()
  if (!employee)
    throw createError({ statusCode: 401, message: `No employee account found for ${googleUser.email}. Please contact your administrator.` })

  if (employee.status === 'Inactive')
    throw createError({ statusCode: 403, message: 'Your account has been deactivated. Please contact your administrator.' })

  // 3. Create session tokens — access token (1 h) + refresh token (7 d)
  const epoch: number = (employee as any).sessionEpoch ?? 0
  const position: string = (employee as any).position ?? ''

  const accessToken = createSessionToken(String(employee._id), employee.email, epoch, 'access', position)
  const refreshToken = createSessionToken(String(employee._id), employee.email, epoch, 'refresh', position)

  const host = event.node.req.headers.host || ''
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1')
  const secure = process.env.NODE_ENV === 'production' && !isLocalhost

  // 4. Set secure HTTP-only cookies
  setCookie(event, 'hardwood_session', accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 60 * 60, // 1 hour (token itself also expires in 1 h)
    path: '/',
  })
  setCookie(event, 'hardwood_refresh', refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  })

  return {
    success: true,
    data: {
      _id: String(employee._id),
      employee: employee.employee,
      email: employee.email,
      position: employee.position,
      profileImage: employee.profileImage || googleUser.picture,
      status: employee.status,
      workspace: employee.workspace || '',
    },
  }
})
