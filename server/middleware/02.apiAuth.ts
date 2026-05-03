/**
 * Server Middleware: API Authentication Guard
 * 
 * Validates the hardwood_session cookie on ALL /api/ requests.
 * Public endpoints (auth, contract signing, public) are whitelisted.
 * This prevents unauthenticated users from accessing ANY API data.
 */
import { verifySessionToken } from '../lib/session'

// Routes that do NOT require authentication
const PUBLIC_PREFIXES = [
    '/api/auth/',          // login, google, logout, me
    '/api/contracts/sign/', // public contract signing portal
    '/api/public/',        // any future public APIs
    '/api/gmail/callback', // Google OAuth2 redirect (no session cookie)
]

// Exact paths that are also public
const PUBLIC_EXACT = [
    '/api/auth/me',        // me endpoint (has its own auth check)
]

export default defineEventHandler((event) => {
    const url = event.path || ''

    // Only guard API routes
    if (!url.startsWith('/api/')) return

    // Skip public/whitelisted routes
    for (const prefix of PUBLIC_PREFIXES) {
        if (url.startsWith(prefix)) return
    }
    if (PUBLIC_EXACT.includes(url)) return

    // Validate session cookie
    const token = getCookie(event, 'hardwood_session')
    if (!token) {
        throw createError({
            statusCode: 401,
            message: 'Authentication required. Please log in.',
        })
    }

    const session = verifySessionToken(token)
    if (!session) {
        // Clear the stale/invalid cookie
        deleteCookie(event, 'hardwood_session', { path: '/' })
        throw createError({
            statusCode: 401,
            message: 'Session expired or invalid. Please log in again.',
        })
    }

    // Attach session to event context for downstream handlers
    ;(event.context as any).session = session
})
