/**
 * tests/unit/rateLimit.test.ts
 * Tests for server/utils/rateLimit.ts — in-memory per-IP rate limiter
 *
 * The rateLimit() function uses h3's getRequestIP(), setResponseHeader(), and
 * createError() as Nitro auto-imports (globals). We polyfill them here so the
 * module can be tested in pure Node without a real HTTP server.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Polyfill Nitro globals BEFORE importing the module under test
;(globalThis as any).setResponseHeader = vi.fn()
;(globalThis as any).createError = (opts: { statusCode: number; message: string }) => {
  const err = new Error(opts.message) as any
  err.statusCode = opts.statusCode
  return err
}

// Mock h3's getRequestIP to avoid needing a real HTTP event
vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    getRequestIP: vi.fn(() => '127.0.0.1'),
  }
})

const { rateLimit } = await import('../../server/utils/rateLimit')

// Minimal event shell — IP reading is mocked
const dummyEvent: any = {}

beforeEach(() => {
  vi.useFakeTimers()
  // Clear the global rate-limit store between tests for isolation
  if ((globalThis as any).__rateLimitStore) {
    ;(globalThis as any).__rateLimitStore.entries.clear()
    ;(globalThis as any).__rateLimitStore.lastGc = Date.now()
  }
})

describe('rateLimit() middleware', () => {
  it('allows requests within the limit', () => {
    const key = `allow-${Math.random()}`
    expect(() => {
      for (let i = 0; i < 4; i++) rateLimit(dummyEvent, { max: 5, windowMs: 60_000, key })
    }).not.toThrow()
  })

  it('throws 429 when the limit is exceeded', () => {
    const key = `block-${Math.random()}`
    // Consume max=3 requests
    for (let i = 0; i < 3; i++) rateLimit(dummyEvent, { max: 3, windowMs: 60_000, key })

    // 4th request should throw a 429 error
    let statusCode: number | undefined
    try {
      rateLimit(dummyEvent, { max: 3, windowMs: 60_000, key })
    }
    catch (err: any) {
      statusCode = err.statusCode
    }
    expect(statusCode).toBe(429)
  })

  it('resets after the window expires', () => {
    const key = `reset-${Math.random()}`

    // Fill up max=2
    for (let i = 0; i < 2; i++) rateLimit(dummyEvent, { max: 2, windowMs: 60_000, key })
    // 3rd should throw
    expect(() => rateLimit(dummyEvent, { max: 2, windowMs: 60_000, key })).toThrow()

    // Advance past the 60s window
    vi.advanceTimersByTime(60_001)

    // Should be allowed again
    expect(() => rateLimit(dummyEvent, { max: 2, windowMs: 60_000, key })).not.toThrow()
  })

  it('tracks different keys independently', () => {
    const key1 = `k1-${Math.random()}`
    const key2 = `k2-${Math.random()}`

    // Exhaust key1
    for (let i = 0; i < 2; i++) rateLimit(dummyEvent, { max: 2, windowMs: 60_000, key: key1 })
    expect(() => rateLimit(dummyEvent, { max: 2, windowMs: 60_000, key: key1 })).toThrow()

    // key2 is independent and should still pass
    expect(() => rateLimit(dummyEvent, { max: 2, windowMs: 60_000, key: key2 })).not.toThrow()
  })

  it('error message includes retry time in seconds', () => {
    const key = `msg-${Math.random()}`
    // Use max=1 so 2nd request triggers the error
    rateLimit(dummyEvent, { max: 1, windowMs: 60_000, key })

    let message = ''
    try { rateLimit(dummyEvent, { max: 1, windowMs: 60_000, key }) }
    catch (err: any) { message = err.message }

    expect(message).toMatch(/\d+ second/)
  })
})
