/**
 * POST /api/google-calendar/disconnect — Revoke tokens and clear Calendar connection
 */
import { connectDB } from '../../utils/mongoose'
import { Employee } from '../../models/Employee'
import { decryptTokens } from '../../lib/gmail-crypto'
import { getCalendarOAuth2Client, calendarFetch } from '../../lib/google-calendar'

export default defineEventHandler(async (event) => {
    const session = (event.context as any).session
    if (!session?.id) throw createError({ statusCode: 401, message: 'Not authenticated' })

    await connectDB()

    const emp: any = await Employee.findById(session.id).lean()
    if (!emp) throw createError({ statusCode: 404, message: 'Employee not found' })

    // Try to stop any active watch channel
    if (emp.calendarTokens && emp.calendarChannelId && emp.calendarResourceId) {
        try {
            const tokens = decryptTokens(emp.calendarTokens)
            if (tokens?.access_token) {
                await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${tokens.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        id: emp.calendarChannelId,
                        resourceId: emp.calendarResourceId,
                    }),
                })
            }
        } catch (e) {
            console.warn('[Calendar Disconnect] Failed to stop watch channel:', e)
        }
    }

    // Try to revoke the token
    if (emp.calendarTokens) {
        try {
            const tokens = decryptTokens(emp.calendarTokens)
            const tokenToRevoke = tokens?.refresh_token || tokens?.access_token
            if (tokenToRevoke) {
                await fetch(`https://oauth2.googleapis.com/revoke?token=${tokenToRevoke}`, { method: 'POST' })
            }
        } catch (e) {
            console.warn('[Calendar Disconnect] Failed to revoke token:', e)
        }
    }

    // Clear all calendar fields
    await Employee.findByIdAndUpdate(session.id, {
        calendarTokens: '',
        calendarEmail: '',
        calendarSyncToken: '',
        calendarChannelId: '',
        calendarResourceId: '',
        calendarChannelExpiry: null,
    })

    return { success: true, message: 'Google Calendar disconnected' }
})
