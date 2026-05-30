import { decryptTokens, encryptTokens } from '../../../lib/gmail-crypto'
import { calendarFetch, getValidCalendarToken } from '../../../lib/google-calendar'
import { Employee } from '../../../models/Employee'
/**
 * DELETE /api/google-calendar/events/[id] — Delete a calendar event
 */
import { connectDB } from '../../../utils/mongoose'

export default defineEventHandler(async (event) => {
  const session = (event.context as any).session
  if (!session?.id)
    throw createError({ statusCode: 401, message: 'Not authenticated' })

  const eventId = getRouterParam(event, 'id')
  if (!eventId)
    throw createError({ statusCode: 400, message: 'Event ID is required' })

  const query = getQuery(event)
  const calendarId = (query.calendarId as string) || 'primary'

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

  // Google Calendar DELETE returns 204 No Content
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => '')
    throw createError({ statusCode: res.status, message: `Failed to delete event: ${text}` })
  }

  return { success: true, message: 'Event deleted' }
})
