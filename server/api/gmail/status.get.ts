/**
 * GET /api/gmail/status — Check if current user has Gmail connected
 */
import { connectDB } from '../../utils/mongoose'
import { Employee } from '../../models/Employee'
import { verifySessionToken } from '../../lib/session'

export default defineEventHandler(async (event) => {
    const token = getCookie(event, 'hardwood_session')
    if (!token) throw createError({ statusCode: 401, message: 'Not authenticated' })

    const session = verifySessionToken(token)
    if (!session) throw createError({ statusCode: 401, message: 'Invalid session' })

    await connectDB()
    const employee = await Employee.findById(session.id).select('gmailTokens gmailEmail').lean<any>()

    return {
        success: true,
        connected: !!(employee?.gmailTokens && employee?.gmailEmail),
        email: employee?.gmailEmail || '',
    }
})
