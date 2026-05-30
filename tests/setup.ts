/**
 * tests/setup.ts — Per-worker test setup (Vitest setupFiles)
 *
 * Runs inside each test worker BEFORE any module is imported.
 * This guarantees that module-level IIFEs (e.g. the SESSION_SECRET guard
 * in session.ts and the GOOGLE_CLIENT_ID guard in google.post.ts) see the
 * required env vars and do not throw during import.
 *
 * Note: setupFiles (not globalSetup) is used here because globalSetup runs
 * in a separate Node process — env vars set there do not propagate to test
 * workers before module-level initialization code executes.
 */

// Required by server/lib/session.ts (module-level IIFE throws if missing)
process.env.SESSION_SECRET = 'test-secret-at-least-32-chars-long-for-hmac'

// Required by server/api/auth/google.post.ts (module-level IIFE throws if missing)
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id.apps.googleusercontent.com'

process.env.NODE_ENV = 'test'
