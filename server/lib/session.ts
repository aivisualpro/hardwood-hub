import crypto from 'node:crypto'

/**
 * Reads SESSION_SECRET and fails fast — unconditionally, at any NODE_ENV.
 *
 * The guard runs once per process start (module-level) so a misconfigured
 * deployment crashes immediately rather than silently serving weak tokens.
 *
 * We intentionally do NOT provide a fallback default: any default value
 * published in source code is a known-plaintext secret and undermines HMAC
 * security even in development (developers often copy .env.example as-is).
 */
const SECRET = (() => {
  const s = process.env.SESSION_SECRET
  if (!s || s.trim() === '') {
    throw new Error(
      'FATAL: SESSION_SECRET environment variable is not set. '
      + 'Generate a strong random value with: '
      + 'node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
    )
  }
  return s
})()

export interface SessionPayload {
  id: string
  email: string
  epoch: number
  type: 'access' | 'refresh'
  position?: string
}

/**
 * Create a signed session token.
 * @param employeeId  Employee _id
 * @param email       Employee email (for logging)
 * @param epoch       Session epoch (incremented on logout/deactivation)
 * @param type        'access' (1 h) or 'refresh' (7 d)
 * @param position    Employee role/position (embedded for RBAC — no DB call on each request)
 */
export function createSessionToken(
  employeeId: string,
  email: string,
  epoch: number = 0,
  type: 'access' | 'refresh' = 'access',
  position: string = '',
): string {
  const expiresIn = type === 'refresh'
    ? 7 * 24 * 60 * 60 * 1000  // 7 days
    : 60 * 60 * 1000             // 1 hour
  const payload = JSON.stringify({
    id: employeeId,
    email,
    epoch,
    type,
    position,
    exp: Date.now() + expiresIn,
  })
  const encoded = Buffer.from(payload).toString('base64url')
  const sig = crypto.createHmac('sha256', SECRET).update(encoded).digest('base64url')
  return `${encoded}.${sig}`
}

/** Verify and decode a session token. Returns null if invalid or expired. */
export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.')
  if (parts.length !== 2)
    return null
  const [encoded, sig] = parts as [string, string]

  const expectedSig = crypto.createHmac('sha256', SECRET).update(encoded).digest('base64url')

  // Constant-time comparison — prevents timing attacks that could reveal
  // partial signature bytes through response-time differences.
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expectedSig)
  if (
    sigBuf.length !== expectedBuf.length
    || !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())
    if (payload.exp < Date.now())
      return null
    return {
      id: payload.id,
      email: payload.email,
      epoch: payload.epoch ?? 0,
      type: payload.type ?? 'access',
      position: payload.position ?? '',
    }
  }
  catch { return null }
}
