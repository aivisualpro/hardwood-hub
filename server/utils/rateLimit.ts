/**
 * server/utils/rateLimit.ts
 *
 * Zero-dependency in-memory rate limiter for Nitro/Nuxt server handlers.
 *
 * Stored on globalThis so it survives module re-evaluation on Vercel
 * (same pattern as the Mongoose connection singleton). Each unique key
 * (usually an IP address) gets a sliding-window token bucket.
 *
 * Usage:
 *   import { rateLimit } from '~/server/utils/rateLimit'
 *
 *   // 10 requests per 60 seconds per IP
 *   rateLimit(event, { max: 10, windowMs: 60_000 })
 *
 * Throws a 429 createError if the limit is exceeded.
 * Returns void on success.
 */

import { getRequestIP } from 'h3'

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimitStore {
  /** key → { count, resetAt } */
  entries: Map<string, RateLimitEntry>
  /** last GC pass timestamp */
  lastGc: number
}

declare global {

  var __rateLimitStore: RateLimitStore | undefined
}

if (!globalThis.__rateLimitStore) {
  globalThis.__rateLimitStore = {
    entries: new Map(),
    lastGc: Date.now(),
  }
}

const store = globalThis.__rateLimitStore

/** Remove expired entries every 5 minutes to prevent unbounded growth */
function maybeGc(now: number): void {
  if (now - store.lastGc < 5 * 60_000)
    return
  store.lastGc = now
  for (const [key, entry] of store.entries) {
    if (now >= entry.resetAt)
      store.entries.delete(key)
  }
}

export interface RateLimitOptions {
  /**
   * Maximum number of requests allowed within the window.
   * @default 20
   */
  max?: number
  /**
   * Window duration in milliseconds.
   * @default 60_000 (1 minute)
   */
  windowMs?: number
  /**
   * Override the bucket key (default: client IP address).
   * Useful for keying per-route: `${ip}:${route}`
   */
  key?: string
}

/**
 * Apply a fixed-window rate limit. Throws a 429 createError if the
 * caller exceeds `max` requests within `windowMs` milliseconds.
 *
 * @param event  - The H3 event (for IP extraction and error creation)
 * @param opts   - Rate limit configuration
 */
export function rateLimit(
  event: Parameters<typeof getRequestIP>[0],
  opts: RateLimitOptions = {},
): void {
  const max = opts.max ?? 20
  const windowMs = opts.windowMs ?? 60_000

  // Prefer x-forwarded-for (Vercel sets this), fall back to socket address
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const key = opts.key ?? ip

  const now = Date.now()
  maybeGc(now)

  const existing = store.entries.get(key)

  if (!existing || now >= existing.resetAt) {
    // New window
    store.entries.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  existing.count++

  if (existing.count > max) {
    const retryAfterSec = Math.ceil((existing.resetAt - now) / 1000)
    setResponseHeader(event, 'Retry-After', retryAfterSec)
    throw createError({
      statusCode: 429,
      message: `Too many requests. Please try again in ${retryAfterSec} seconds.`,
    })
  }
}
