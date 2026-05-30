/**
 * GET /api/google-calendar/auth-url — Generate Google Calendar OAuth2 consent URL
 */
import { getCalendarAuthUrl } from '../../lib/google-calendar'
import { verifySessionToken } from '../../lib/session'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'hardwood_session')
  if (!token)
    throw createError({ statusCode: 401, message: 'Not authenticated' })

  const session = verifySessionToken(token)
  if (!session)
    throw createError({ statusCode: 401, message: 'Invalid session' })

  try {
    const url = getCalendarAuthUrl(session.id)
    return { success: true, url }
  }
  catch (e: any) {
    throw createError({ statusCode: 500, message: e.message })
  }
})
