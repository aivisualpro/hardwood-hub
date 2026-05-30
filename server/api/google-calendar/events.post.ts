import { decryptTokens, encryptTokens } from '../../lib/gmail-crypto'
import { buildEventBody, calendarFetch, getValidCalendarToken, parseCalendarEvent } from '../../lib/google-calendar'
import { Employee } from '../../models/Employee'
/**
 * POST /api/google-calendar/events — Create a new calendar event
 * Body: { summary, description?, location?, start, end, allDay?, attendees?, timeZone? }
 */
import { connectDB } from '../../utils/mongoose'

export default defineEventHandler(async (event) => {
  const session = (event.context as any).session
  if (!session?.id)
    throw createError({ statusCode: 401, message: 'Not authenticated' })

  const body = await readBody(event)
  if (!body.summary || !body.start || !body.end) {
    throw createError({ statusCode: 400, message: 'summary, start, and end are required' })
  }

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

  const eventBody = buildEventBody(body)
  const calendarId = body.calendarId || 'primary'

  const created = await calendarFetch(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      body: JSON.stringify(eventBody),
    },
  )

  return { success: true, data: parseCalendarEvent(created) }
})
