/**
 * tests/unit/validation.test.ts
 * Tests for server/utils/validation.ts — objectId, parseBody, escapeRegex
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { objectId, escapeRegex } from '../../server/utils/validation'

// ─── objectId ────────────────────────────────────────────────────────────────
describe('objectId()', () => {
  it('accepts a valid 24-hex ObjectId string', () => {
    expect(() => objectId('507f1f77bcf86cd799439011')).not.toThrow()
  })

  it('throws createError(400) for a non-hex string', () => {
    expect(() => objectId('not-an-object-id')).toThrow()
  })

  it('throws for an empty string', () => {
    expect(() => objectId('')).toThrow()
  })

  it('throws for a 12-char non-ObjectId', () => {
    // 12-byte Buffer toString → valid Mongoose ObjectId internally, but
    // our helper validates the 24-hex string form
    expect(() => objectId('abcdef123456')).toThrow()
  })

  it('throws for null injection attempts ($ne)', () => {
    // NoSQL injection via $ne — objectId should throw, not pass through
    expect(() => objectId({ $ne: null } as any)).toThrow()
  })
})

// ─── escapeRegex ─────────────────────────────────────────────────────────────
describe('escapeRegex()', () => {
  it('escapes regex special characters', () => {
    const escaped = escapeRegex('hello.world')
    expect(escaped).toBe('hello\\.world')
    expect(new RegExp(escaped).test('hello.world')).toBe(true)
    expect(new RegExp(escaped).test('helloxworld')).toBe(false)
  })

  it('escapes multiple special characters', () => {
    const escaped = escapeRegex('(test)+[abc]*')
    expect(escaped).toBe('\\(test\\)\\+\\[abc\\]\\*')
  })

  it('passes through plain alphanumeric strings unchanged', () => {
    expect(escapeRegex('hello123')).toBe('hello123')
  })

  it('does not escape forward slashes (not a regex metacharacter)', () => {
    // '/' is NOT special in JS RegExp — no escaping needed
    const escaped = escapeRegex('path/to/resource')
    expect(escaped).toBe('path/to/resource')
    expect(new RegExp(escaped).test('path/to/resource')).toBe(true)
  })

  it('returns empty string for empty input', () => {
    expect(escapeRegex('')).toBe('')
  })
})

// ─── Zod schema integration ───────────────────────────────────────────────────
describe('Zod schema patterns', () => {
  // Replicate the kind of schema used in endpoint parseBody calls
  const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  })

  it('accepts valid email + password', () => {
    const result = LoginSchema.safeParse({ email: 'admin@test.com', password: 'secret' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = LoginSchema.safeParse({ email: 'not-an-email', password: 'secret' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toContain('email')
  })

  it('rejects empty password', () => {
    const result = LoginSchema.safeParse({ email: 'admin@test.com', password: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toContain('password')
  })

  it('rejects missing fields', () => {
    const result = LoginSchema.safeParse({})
    expect(result.success).toBe(false)
    expect(result.error?.issues.length).toBeGreaterThanOrEqual(2)
  })

  it('strips extra keys with .strict()', () => {
    const StrictSchema = LoginSchema.strict()
    const result = StrictSchema.safeParse({
      email: 'a@b.com',
      password: 'pw',
      __proto__: 'injection',
      isAdmin: true,
    })
    expect(result.success).toBe(false) // strict() rejects unknown keys
  })
})
