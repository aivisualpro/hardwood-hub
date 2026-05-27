/**
 * GET /api/google-calendar/events — List calendar events
 * Query params:
 *   timeMin — ISO date (defaults to start of current month)
 *   timeMax — ISO date (defaults to end of current month)
 *   calendarId — defaults to 'primary'
 */
import { connectDB } from '../../utils/mongoose'
import { Employee } from '../../models/Employee'
import { decryptTokens, encryptTokens } from '../../lib/gmail-crypto'
import { getValidCalendarToken, calendarFetch, parseCalendarEvent } from '../../lib/google-calendar'

export default defineEventHandler(async (event) => {
    const session = (event.context as any).session
    if (!session?.id) throw createError({ statusCode: 401, message: 'Not authenticated' })

    await connectDB()

    const emp: any = await Employee.findById(session.id).lean()
    if (!emp?.calendarTokens) {
        throw createError({ statusCode: 400, message: 'Google Calendar not connected' })
    }

    const tokens = decryptTokens(emp.calendarTokens)
    if (!tokens) throw createError({ statusCode: 400, message: 'Invalid calendar tokens' })

    // Get valid access token (refresh if needed)
    const { accessToken, refreshedTokens } = await getValidCalendarToken(tokens)

    // If tokens were refreshed, save them back
    if (refreshedTokens) {
        const merged = { ...tokens, ...refreshedTokens }
        await Employee.findByIdAndUpdate(session.id, {
            calendarTokens: encryptTokens(merged),
        })
    }

    const query = getQuery(event)
    const now = new Date()
    const timeMin = (query.timeMin as string) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const timeMax = (query.timeMax as string) || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
    const calendarId = (query.calendarId as string) || 'primary'

    const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
    })

    const data = await calendarFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events?${params}`)

    return {
        success: true,
        data: {
            events: (data.items || []).map(parseCalendarEvent),
            nextSyncToken: data.nextSyncToken || '',
            timeZone: data.timeZone || 'America/Detroit',
        },
    }
})
