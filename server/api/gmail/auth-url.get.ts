/**
 * GET /api/gmail/auth-url — Generate Google OAuth2 consent URL for Gmail
 */
import { getAuthUrl } from '../../lib/gmail'
import { verifySessionToken } from '../../lib/session'

export default defineEventHandler(async (event) => {
    const token = getCookie(event, 'hardwood_session')
    if (!token) throw createError({ statusCode: 401, message: 'Not authenticated' })

    const session = verifySessionToken(token)
    if (!session) throw createError({ statusCode: 401, message: 'Invalid session' })

    try {
        const url = getAuthUrl(session.id)
        return { success: true, url }
    } catch (e: any) {
        throw createError({ statusCode: 500, message: e.message })
    }
})
