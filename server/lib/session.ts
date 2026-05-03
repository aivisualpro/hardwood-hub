import crypto from 'crypto'

const DEFAULT_SECRET = 'hardwood-hub-default-secret-change-in-production'

function getSecret(): string {
    const secret = process.env.SESSION_SECRET || DEFAULT_SECRET
    if (secret === DEFAULT_SECRET && process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: SESSION_SECRET must be set in production. Using the default secret is a critical security vulnerability.')
    }
    return secret
}

// Create a signed session token
export function createSessionToken(employeeId: string, email: string): string {
    const secret = getSecret()
    const payload = JSON.stringify({ id: employeeId, email, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })
    const encoded = Buffer.from(payload).toString('base64url')
    const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url')
    return `${encoded}.${sig}`
}

// Verify and decode a session token
export function verifySessionToken(token: string): { id: string, email: string } | null {
    const secret = getSecret()
    const parts = token.split('.')
    if (parts.length !== 2) return null
    const [encoded, sig] = parts
    const expectedSig = crypto.createHmac('sha256', secret).update(encoded!).digest('base64url')
    if (sig !== expectedSig) return null
    try {
        const payload = JSON.parse(Buffer.from(encoded!, 'base64url').toString())
        if (payload.exp < Date.now()) return null
        return { id: payload.id, email: payload.email }
    }
    catch { return null }
}
