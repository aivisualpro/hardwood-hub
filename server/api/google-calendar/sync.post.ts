/**
 * POST /api/google-calendar/sync — Manual sync + set up push notification watch channel
 *
 * 1. Fetches events to get a syncToken
 * 2. Creates a watch channel for push notifications (on production only)
 */
import crypto from 'node:crypto'
import { decryptTokens, encryptTokens } from '../../lib/gmail-crypto'
import { calendarFetch, getValidCalendarToken } from '../../lib/google-calendar'
import { Employee } from '../../models/Employee'
import { connectDB } from '../../utils/mongoose'
import { logger } from '../../utils/logger'
const log = logger('[sync.post]')

export default defineEventHandler(async (event) => {
  const session = (event.context as any).session
  if (!session?.id)
    throw createError({ statusCode: 401, message: 'Not authenticated' })

  await connectDB()

  const emp: any = await Employee.findById(session.id).lean()
  if (!emp?.calendarTokens) {
    throw createError({ statusCode: 400, message: 'Google Calendar not connected' })
  }

  const tokens = decryptTokens(emp.calendarTokens)
  if (!tokens)
    throw createError({ statusCode: 400, message: 'Invalid calendar tokens' })

  const { accessToken, refreshedTokens } = await getValidCalendarToken(tokens)
  if (refreshedTokens) {
    await Employee.findByIdAndUpdate(session.id, {
      calendarTokens: encryptTokens({ ...tokens, ...refreshedTokens }),
    })
  }

  // 1. Full sync to get syncToken
  const now = new Date()
  const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString() // 1 month back
  const timeMax = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString() // 3 months forward

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '2500',
  })

  const data = await calendarFetch(accessToken, `/calendars/primary/events?${params}`)
  const eventCount = data.items?.length || 0

  const updates: any = {}
  if (data.nextSyncToken) {
    updates.calendarSyncToken = data.nextSyncToken
  }

  // 2. Set up watch channel (only on production with HTTPS)
  const baseUrl = process.env.NUXT_PUBLIC_SITE_URL || ''
  let watchResult = null

  if (baseUrl.startsWith('https://')) {
    // Stop existing watch channel first
    if (emp.calendarChannelId && emp.calendarResourceId) {
      try {
        await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: emp.calendarChannelId,
            resourceId: emp.calendarResourceId,
          }),
        })
      }
      catch (e) {
        log.warn('[Calendar Sync] Failed to stop old watch channel:', e)
      }
    }

    // Create new watch channel
    const channelId = crypto.randomUUID()
    const channelToken = crypto.randomBytes(32).toString('hex') // secret for webhook verification
    const expiration = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days

    try {
      const watchData = await calendarFetch(
        accessToken,
        `/calendars/primary/events/watch`,
        {
          method: 'POST',
          body: JSON.stringify({
            id: channelId,
            token: channelToken,
            type: 'web_hook',
            address: `${baseUrl}/api/google-calendar/webhook`,
            expiration: String(expiration),
          }),
        },
      )

      updates.calendarChannelId = watchData.id || channelId
      updates.calendarResourceId = watchData.resourceId || ''
      updates.calendarChannelToken = channelToken
      updates.calendarChannelExpiry = new Date(Number(watchData.expiration) || expiration)

      watchResult = {
        channelId: updates.calendarChannelId,
        expiry: updates.calendarChannelExpiry,
      }
    }
    catch (e: any) {
      log.error('[Calendar Sync] Failed to create watch channel:', e.message)
      watchResult = { error: e.message }
    }
  }

  // Save updates
  if (Object.keys(updates).length) {
    await Employee.findByIdAndUpdate(session.id, updates)
  }

  return {
    success: true,
    data: {
      eventCount,
      syncToken: !!data.nextSyncToken,
      watch: watchResult,
    },
  }
})
