/**
 * POST /api/gmail/disconnect — Disconnect Gmail (revoke tokens, clear from DB)
 */
import { connectDB } from '../../utils/mongoose'
import { Employee } from '../../models/Employee'
import { verifySessionToken } from '../../lib/session'
import { decryptTokens } from '../../lib/gmail-crypto'
import { getOAuth2Client } from '../../lib/gmail'

export default defineEventHandler(async (event) => {
    const token = getCookie(event, 'hardwood_session')
    if (!token) throw createError({ statusCode: 401, message: 'Not authenticated' })

    const session = verifySessionToken(token)
    if (!session) throw createError({ statusCode: 401, message: 'Invalid session' })

    await connectDB()
    const employee = await Employee.findById(session.id).lean<any>()

    if (employee?.gmailTokens) {
        // Try to revoke the token with Google
        try {
            const tokens = decryptTokens(employee.gmailTokens)
            if (tokens?.access_token) {
                const client = getOAuth2Client()
                await client.revokeToken(tokens.access_token)
            }
        } catch { /* Revocation is best-effort */ }
    }

    await Employee.findByIdAndUpdate(session.id, {
        gmailTokens: '',
        gmailEmail: '',
    })

    return { success: true }
})
