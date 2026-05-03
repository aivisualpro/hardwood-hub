/**
 * GET /api/gmail/callback — OAuth2 callback from Google
 * Exchanges the authorization code for tokens, encrypts and stores them.
 */
import { connectDB } from '../../utils/mongoose'
import { Employee } from '../../models/Employee'
import { exchangeCodeForTokens, gmailFetch } from '../../lib/gmail'
import { encryptTokens } from '../../lib/gmail-crypto'

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
        const tokens = await exchangeCodeForTokens(code)

        if (!tokens.access_token) {
            throw new Error('No access token received from Google')
        }

        // 2. Get the user's Gmail address
        const profile = await gmailFetch(tokens.access_token, '/profile')
        const gmailEmail = profile.emailAddress || ''

        // 3. Encrypt and store tokens
        const encrypted = encryptTokens(tokens)
        await Employee.findByIdAndUpdate(employeeId, {
            gmailTokens: encrypted,
            gmailEmail: gmailEmail,
        })

        // 4. Redirect back to profile with success
        return sendRedirect(event, '/my-profile?gmailConnected=true')
    } catch (e: any) {
        console.error('[Gmail Callback Error]', e)
        return sendRedirect(event, `/my-profile?gmailError=${encodeURIComponent(e.message || 'Connection failed')}`)
    }
})
