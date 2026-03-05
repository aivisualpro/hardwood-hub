// Server middleware: protect all API routes (except /api/auth/*) with session verification
import { verifySessionToken } from '../api/auth/google.post'

export default defineEventHandler((event) => {
    const path = event.path || ''

    // Skip auth check for auth endpoints and public assets
    if (
        path.startsWith('/api/auth/')
        || !path.startsWith('/api/')
        || path.startsWith('/_nuxt/')
        || path.startsWith('/__nuxt')
    ) {
        return // allow through
    }

    const token = getCookie(event, 'hardwood_session')
    if (!token) {
        throw createError({ statusCode: 401, message: 'Authentication required' })
    }

    const session = verifySessionToken(token)
    if (!session) {
        throw createError({ statusCode: 401, message: 'Invalid or expired session' })
    }

    // Attach user info to context for downstream handlers
    event.context.auth = session
})
