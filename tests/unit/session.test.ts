/**
 * tests/unit/session.test.ts
 * Tests for server/lib/session.ts — createSessionToken / verifySessionToken
 *
 * SESSION_SECRET is set in tests/setup.ts (setupFiles) BEFORE this module is
 * imported, so the module-level IIFE in session.ts sees the test secret.
 */
import crypto from 'node:crypto'
import { describe, it, expect } from 'vitest'
import { createSessionToken, verifySessionToken } from '../../server/lib/session'

// The test secret set in tests/setup.ts
const TEST_SECRET = 'test-secret-at-least-32-chars-long-for-hmac'

describe('createSessionToken', () => {
  it('returns a dot-separated base64url.sig string', () => {
    const token = createSessionToken('emp123', 'alice@example.com', 0, 'access', 'Installer')
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  })

  it('encodes all payload fields', () => {
    const token = createSessionToken('emp123', 'alice@example.com', 5, 'refresh', 'Manager')
    const [encoded] = token.split('.')
    const payload = JSON.parse(Buffer.from(encoded!, 'base64url').toString())
    expect(payload.id).toBe('emp123')
    expect(payload.email).toBe('alice@example.com')
    expect(payload.epoch).toBe(5)
    expect(payload.type).toBe('refresh')
    expect(payload.position).toBe('Manager')
    expect(payload.exp).toBeGreaterThan(Date.now())
  })

  it('uses 1-hour expiry for access tokens', () => {
    const before = Date.now()
    const token = createSessionToken('emp123', 'a@b.com', 0, 'access')
    const [encoded] = token.split('.')
    const { exp } = JSON.parse(Buffer.from(encoded!, 'base64url').toString())
    expect(exp - before).toBeGreaterThan(60 * 60 * 1000 - 5000)
    expect(exp - before).toBeLessThanOrEqual(60 * 60 * 1000 + 5000)
  })

  it('uses 7-day expiry for refresh tokens', () => {
    const before = Date.now()
    const token = createSessionToken('emp123', 'a@b.com', 0, 'refresh')
    const [encoded] = token.split('.')
    const { exp } = JSON.parse(Buffer.from(encoded!, 'base64url').toString())
    expect(exp - before).toBeGreaterThan(7 * 24 * 60 * 60 * 1000 - 5000)
    expect(exp - before).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000 + 5000)
  })
})

describe('verifySessionToken', () => {
  it('returns the session payload for a valid token', () => {
    const token = createSessionToken('emp999', 'bob@example.com', 3, 'access', 'Admin')
    const result = verifySessionToken(token)
    expect(result).not.toBeNull()
    expect(result!.id).toBe('emp999')
    expect(result!.email).toBe('bob@example.com')
    expect(result!.epoch).toBe(3)
    expect(result!.type).toBe('access')
    expect(result!.position).toBe('Admin')
  })

  it('returns null for a tampered signature', () => {
    const token = createSessionToken('emp1', 'x@y.com')
    const [encoded] = token.split('.')
    expect(verifySessionToken(`${encoded}.invalidsignature`)).toBeNull()
  })

  it('returns null for a token signed with a different secret (timing-safe check)', () => {
    // Build a token using a different HMAC key — simulates a token from another
    // environment. The real SECRET in the server is the TEST_SECRET; this token
    // is signed with 'wrong-secret' so timingSafeEqual should reject it.
    const wrongSecret = 'wrong-secret-completely-different-value-here'
    const payload = JSON.stringify({
      id: 'emp1', email: 'x@y.com', epoch: 0, type: 'access', position: '',
      exp: Date.now() + 60 * 60 * 1000,
    })
    const encoded = Buffer.from(payload).toString('base64url')
    const sig = crypto.createHmac('sha256', wrongSecret).update(encoded).digest('base64url')
    const foreignToken = `${encoded}.${sig}`

    expect(verifySessionToken(foreignToken)).toBeNull()
  })

  it('returns null for a token with wrong format (no dot)', () => {
    expect(verifySessionToken('nodothere')).toBeNull()
  })

  it('returns null for an expired token', () => {
    // Build a token manually with exp in the past, signed with the test secret
    const payload = JSON.stringify({
      id: 'emp1', email: 'x@y.com', epoch: 0, type: 'access', position: '',
      exp: Date.now() - 1000, // already expired
    })
    const encoded = Buffer.from(payload).toString('base64url')
    const sig = crypto.createHmac('sha256', TEST_SECRET).update(encoded).digest('base64url')
    expect(verifySessionToken(`${encoded}.${sig}`)).toBeNull()
  })
})
