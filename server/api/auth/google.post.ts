import https from 'node:https'
import crypto from 'node:crypto'
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

// ---------------------------------------------------------------------------
// Manual Google JWT verification — replaces google-auth-library's
// verifyIdToken() which breaks on Node 24 due to undici's stricter fetch
// throwing "expected non-null body source". Uses node:https (not undici)
// to fetch Google's JWKS and node:crypto to verify the RSA signature.
//
// Security guarantees are identical:
//  - RSA signature verified against Google's cached JWKS public keys
//  - Audience (aud) enforced unconditionally
//  - Issuer (iss) restricted to accounts.google.com
//  - Token expiry (exp) checked with 5-minute clock-skew tolerance
// ---------------------------------------------------------------------------

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const VALID_ISSUERS = ['accounts.google.com', 'https://accounts.google.com']
const CLOCK_SKEW_SECS = 300 // 5 min tolerance

/** Cached JWKS + expiry time (re-fetched when stale or on cache miss) */
let jwksCache: { keys: any[], expiresAt: number } = { keys: [], expiresAt: 0 }

/** Fetch Google's JWKS using node:https — bypasses undici/fetch entirely */
function fetchJWKS(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    https.get(GOOGLE_CERTS_URL, (res) => {
      let data = ''
      // Parse Cache-Control max-age to know when to re-fetch
      const cacheControl = res.headers['cache-control'] || ''
      const maxAgeMatch = cacheControl.match(/max-age=(\d+)/)
      const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600

      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          jwksCache = { keys: parsed.keys, expiresAt: Date.now() + maxAge * 1000 }
          resolve(parsed.keys)
        }
        catch (e) { reject(new Error('Failed to parse Google JWKS')) }
      })
      res.on('error', reject)
    }).on('error', reject)
  })
}

/** Get (possibly cached) JWKS keys */
async function getGoogleKeys(): Promise<any[]> {
  if (Date.now() < jwksCache.expiresAt && jwksCache.keys.length > 0)
    return jwksCache.keys
  return fetchJWKS()
}

/** Base64url decode */
function b64urlDecode(str: string): Buffer {
  // Pad to multiple of 4
  const padded = str + '='.repeat((4 - str.length % 4) % 4)
  return Buffer.from(padded, 'base64')
}

/**
 * Verify a Google ID token's signature, audience, issuer, and expiry.
 * Returns the decoded payload on success; throws on any failure.
 */
async function verifyGoogleToken(credential: string): Promise<{
  email: string
  name: string
  picture: string
  sub: string
}> {
  const parts = credential.split('.')
  if (parts.length !== 3)
    throw new Error('Malformed JWT: expected 3 parts')

  const [headerB64, payloadB64, signatureB64] = parts
  const header = JSON.parse(b64urlDecode(headerB64!).toString())
  const payload = JSON.parse(b64urlDecode(payloadB64!).toString())

  // 1. Find the matching key by kid
  const keys = await getGoogleKeys()
  const key = keys.find((k: any) => k.kid === header.kid)
  if (!key)
    throw new Error(`No matching Google key for kid=${header.kid}`)

  // 2. Verify RSA signature
  const publicKey = crypto.createPublicKey({ key, format: 'jwk' })
  const signedData = `${headerB64}.${payloadB64}`
  const signature = b64urlDecode(signatureB64!)
  const alg = header.alg === 'RS256' ? 'sha256' : 'sha256' // Google uses RS256

  const isValid = crypto.createVerify(alg)
    .update(signedData)
    .verify(publicKey, signature)

  if (!isValid)
    throw new Error('Invalid JWT signature')

  // 3. Verify issuer
  if (!VALID_ISSUERS.includes(payload.iss))
    throw new Error(`Invalid issuer: ${payload.iss}`)

  // 4. Verify audience
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  if (!aud.includes(GOOGLE_CLIENT_ID))
    throw new Error(`Token audience ${payload.aud} does not match client ID`)

  // 5. Verify expiry (with clock skew tolerance)
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp && payload.exp + CLOCK_SKEW_SECS < now)
    throw new Error('Token has expired')
  if (payload.iat && payload.iat - CLOCK_SKEW_SECS > now)
    throw new Error('Token issued in the future')

  // 6. Require email
  if (!payload.email)
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
