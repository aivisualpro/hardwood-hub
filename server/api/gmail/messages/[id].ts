/**
 * GET /api/gmail/messages/:id — Get full message content
 */
import { connectDB } from '../../../utils/mongoose'
import { Employee } from '../../../models/Employee'
import { verifySessionToken } from '../../../lib/session'
import { decryptTokens, encryptTokens } from '../../../lib/gmail-crypto'
import { getValidAccessToken, gmailFetch, parseGmailMessage } from '../../../lib/gmail'

export default defineEventHandler(async (event) => {
    const token = getCookie(event, 'hardwood_session')
    if (!token) throw createError({ statusCode: 401, message: 'Not authenticated' })

    const session = verifySessionToken(token)
    if (!session) throw createError({ statusCode: 401, message: 'Invalid session' })

    const messageId = getRouterParam(event, 'id')
    if (!messageId) throw createError({ statusCode: 400, message: 'Message ID required' })

    await connectDB()
    const employee = await Employee.findById(session.id).select('gmailTokens').lean<any>()
    if (!employee?.gmailTokens) throw createError({ statusCode: 400, message: 'Gmail not connected' })

    const tokens = decryptTokens(employee.gmailTokens)
    if (!tokens) throw createError({ statusCode: 400, message: 'Gmail tokens corrupted' })

    const { accessToken, refreshedTokens } = await getValidAccessToken(tokens)
    if (refreshedTokens) {
        await Employee.findByIdAndUpdate(session.id, {
            gmailTokens: encryptTokens({ ...tokens, ...refreshedTokens }),
        })
    }

    // Mark as read
    if (event.method === 'GET') {
        try {
            const msg = await gmailFetch(accessToken, `/messages/${messageId}?format=full`)

            // Auto-mark as read
            if (msg.labelIds?.includes('UNREAD')) {
                try {
                    await gmailFetch(accessToken, `/messages/${messageId}/modify`, {
                        method: 'POST',
                        body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
                    })
                } catch { /* best effort */ }
            }

            return { success: true, data: parseGmailMessage(msg) }
        } catch (e: any) {
            throw createError({ statusCode: 502, message: 'Failed to fetch message: ' + e.message })
        }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
