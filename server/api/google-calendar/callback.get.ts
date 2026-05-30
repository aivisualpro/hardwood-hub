import { encryptTokens } from '../../lib/gmail-crypto'
import { calendarFetch, exchangeCalendarCode } from '../../lib/google-calendar'
import { Employee } from '../../models/Employee'
/**
 * GET /api/google-calendar/callback — OAuth2 callback from Google
 * Exchanges the authorization code for tokens, encrypts and stores them.
 */
import { connectDB } from '../../utils/mongoose'
import { logger } from '../../utils/logger'
const log = logger('[callback.get]')

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = query.code as string
  const employeeId = query.state as string

  if (!code || !employeeId) {
    throw createError({ statusCode: 400, message: 'Missing code or state parameter' })
  }

  await connectDB()

  try {
    // 1. Exchange code for tokens
    const tokens = await exchangeCalendarCode(code)

    if (!tokens.access_token) {
      throw new Error('No access token received from Google')
    }

    // 2. Get the user's email
    const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }).then(r => r.json())
    const calendarEmail = userInfo.email || ''

    // 3. Encrypt and store tokens
    const encrypted = encryptTokens(tokens)
    await Employee.findByIdAndUpdate(employeeId, {
      calendarTokens: encrypted,
      calendarEmail,
    })

    // 4. Redirect back to settings with success
    return sendRedirect(event, '/admin/general-settings/integrations?calendarConnected=true')
  }
  catch (e: any) {
    log.error('[Calendar Callback Error]', e)
    return sendRedirect(event, `/admin/general-settings/integrations?calendarError=${encodeURIComponent(e.message || 'Connection failed')}`)
  }
})
