/**
 * PUT /api/google-calendar/events/[id] — Update a calendar event
 */
import { connectDB } from '../../../utils/mongoose'
import { Employee } from '../../../models/Employee'
import { decryptTokens, encryptTokens } from '../../../lib/gmail-crypto'
import { getValidCalendarToken, calendarFetch, buildEventBody, parseCalendarEvent } from '../../../lib/google-calendar'

export default defineEventHandler(async (event) => {
    const session = (event.context as any).session
    if (!session?.id) throw createError({ statusCode: 401, message: 'Not authenticated' })

    const eventId = getRouterParam(event, 'id')
    if (!eventId) throw createError({ statusCode: 400, message: 'Event ID is required' })

    const body = await readBody(event)

    await connectDB()

    const emp: any = await Employee.findById(session.id).lean()
    if (!emp?.calendarTokens) {
        throw createError({ statusCode: 400, message: 'Google Calendar not connected' })
    }

    const tokens = decryptTokens(emp.calendarTokens)
    if (!tokens) throw createError({ statusCode: 400, message: 'Invalid calendar tokens' })

    const { accessToken, refreshedTokens } = await getValidCalendarToken(tokens)
    if (refreshedTokens) {
        await Employee.findByIdAndUpdate(session.id, {
            calendarTokens: encryptTokens({ ...tokens, ...refreshedTokens }),
        })
    }

    const calendarId = body.calendarId || 'primary'
    const eventBody = buildEventBody(body)

    const updated = await calendarFetch(
        accessToken,
        `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
            method: 'PUT',
            body: JSON.stringify(eventBody),
        }
    )

    return { success: true, data: parseCalendarEvent(updated) }
})
