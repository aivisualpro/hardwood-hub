import { checkEpoch } from '../../lib/epochCache'
import { createSessionToken, verifySessionToken } from '../../lib/session'
import { Employee } from '../../models/Employee'
// POST /api/auth/refresh — silently issue a new access token using the refresh cookie
// Called automatically by the client when an API request returns 401.
// Does NOT re-verify with Google — epoch check is the revocation gate.
import { connectDB } from '../../utils/mongoose'
import { rateLimit } from '../../utils/rateLimit'

export default defineEventHandler(async (event) => {
  // H3: 30 refresh attempts per minute per IP
  rateLimit(event, { max: 30, windowMs: 60_000 })

  const refreshToken = getCookie(event, 'hardwood_refresh')

  if (!refreshToken)
    throw createError({ statusCode: 401, message: 'No refresh token. Please log in again.' })

  // 1. Verify HMAC + expiry
  const session = verifySessionToken(refreshToken)
  if (!session || session.type !== 'refresh')
    throw createError({ statusCode: 401, message: 'Invalid or expired refresh token. Please log in again.' })

  // 2. Epoch check — catches logout/revoke/deactivation
  const epochValid = await checkEpoch(session.id, session.epoch)
  if (!epochValid) {
    deleteCookie(event, 'hardwood_session', { path: '/' })
    deleteCookie(event, 'hardwood_refresh', { path: '/' })
    throw createError({ statusCode: 401, message: 'Session has been revoked. Please log in again.' })
  }

  // 3. Verify employee still exists and is active
  await connectDB()
  const employee = await Employee.findById(session.id).select('status sessionEpoch position').lean<any>()
  if (!employee)
    throw createError({ statusCode: 401, message: 'Account not found. Please log in again.' })
  if (employee.status === 'Inactive')
    throw createError({ statusCode: 403, message: 'Account deactivated.' })

  // 4. Re-issue access token with the CURRENT db epoch (picks up any interim bumps)
  const currentEpoch: number = employee.sessionEpoch ?? 0
  const newAccessToken = createSessionToken(session.id, session.email, currentEpoch, 'access', employee.position ?? '')

  const host = event.node.req.headers.host || ''
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1')
  const secure = process.env.NODE_ENV === 'production' && !isLocalhost

  setCookie(event, 'hardwood_session', newAccessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 60 * 60, // 1 hour
    path: '/',
  })

  return { success: true }
})
