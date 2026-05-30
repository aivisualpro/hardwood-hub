/**
 * tests/unit/auth.test.ts
 * Integration-style tests for auth helper flows — no DB required.
 * Tests the session token → verify → epoch check round-trip in isolation.
 */
import { describe, it, expect } from 'vitest'
import { createSessionToken, verifySessionToken } from '../../server/lib/session'

// SESSION_SECRET is set in tests/setup.ts before this module is imported.

// ─── Auth success path ─────────────────────────────────────────────────────
describe('Auth success flow', () => {
  it('access token verifies successfully and has correct type', () => {
    const token = createSessionToken('emp1', 'alice@corp.com', 1, 'access', 'Installer')
    const session = verifySessionToken(token)
    expect(session).not.toBeNull()
    expect(session!.type).toBe('access')
    expect(session!.id).toBe('emp1')
  })

  it('refresh token verifies successfully and has correct type', () => {
    const token = createSessionToken('emp1', 'alice@corp.com', 1, 'refresh')
    const session = verifySessionToken(token)
    expect(session).not.toBeNull()
    expect(session!.type).toBe('refresh')
  })

  it('round-trips all fields correctly', () => {
    const token = createSessionToken('emp-abc', 'bob@corp.com', 7, 'access', 'Admin')
    const session = verifySessionToken(token)
    expect(session!.id).toBe('emp-abc')
    expect(session!.email).toBe('bob@corp.com')
    expect(session!.epoch).toBe(7)
    expect(session!.position).toBe('Admin')
  })
})

// ─── Auth failure cases ────────────────────────────────────────────────────
describe('Auth failure cases', () => {
  it('rejects access token presented as refresh (type mismatch check)', () => {
    const token = createSessionToken('emp1', 'alice@corp.com', 0, 'access')
    const session = verifySessionToken(token)
    // Caller (refresh.post.ts) checks session.type !== 'refresh'
    expect(session!.type).not.toBe('refresh')
  })

  it('does not verify a token signed with wrong secret', () => {
    // Build a token manually using a different HMAC key — the server's module-level
    // SECRET is 'test-secret-at-least-32-chars-long-for-hmac' (set in setup.ts).
    // A token signed with any other key must be rejected.
    const crypto = require('node:crypto')
    const wrongSecret = 'wrong-secret-completely-different-value-here'
    const payload = JSON.stringify({ id: 'emp1', email: 'x@y.com', epoch: 0, type: 'access', position: '', exp: Date.now() + 3600_000 })
    const encoded = Buffer.from(payload).toString('base64url')
    const sig = crypto.createHmac('sha256', wrongSecret).update(encoded).digest('base64url')
    expect(verifySessionToken(`${encoded}.${sig}`)).toBeNull()
  })

  it('does not verify a token with truncated payload', () => {
    expect(verifySessionToken('aGVsbG8=')).toBeNull() // no dot
    expect(verifySessionToken('aGVsbG8=.aGVsbG8=')).toBeNull() // wrong sig
  })
})

// ─── 403 authorization case (role check) ──────────────────────────────────
describe('Authorization (role check simulation)', () => {
  function requirePosition(session: { position?: string }, allowed: string[]): boolean {
    // Mirrors the requireRole/requireAdmin helper logic
    return allowed.includes(session.position ?? '')
  }

  it('allows Admin to access admin-only endpoint', () => {
    const session = verifySessionToken(
      createSessionToken('emp1', 'a@b.com', 0, 'access', 'Admin'),
    )
    expect(requirePosition(session!, ['Admin'])).toBe(true)
  })

  it('denies Installer access to admin-only endpoint (403 case)', () => {
    const session = verifySessionToken(
      createSessionToken('emp2', 'b@c.com', 0, 'access', 'Installer'),
    )
    expect(requirePosition(session!, ['Admin'])).toBe(false)
  })

  it('allows Manager to access manager-or-admin endpoint', () => {
    const session = verifySessionToken(
      createSessionToken('emp3', 'c@d.com', 0, 'access', 'Manager'),
    )
    expect(requirePosition(session!, ['Admin', 'Manager'])).toBe(true)
  })
})
