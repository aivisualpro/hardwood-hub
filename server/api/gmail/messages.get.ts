/**
 * GET /api/gmail/messages — List Gmail messages
 * Query params: folder (INBOX|SENT|DRAFT|TRASH|STARRED), maxResults, pageToken, q (search)
 */
import { connectDB } from '../../utils/mongoose'
import { Employee } from '../../models/Employee'
import { verifySessionToken } from '../../lib/session'
import { decryptTokens, encryptTokens } from '../../lib/gmail-crypto'
import { getValidAccessToken, gmailFetch, parseGmailMessage } from '../../lib/gmail'

export default defineEventHandler(async (event) => {
    const token = getCookie(event, 'hardwood_session')
    if (!token) throw createError({ statusCode: 401, message: 'Not authenticated' })

    const session = verifySessionToken(token)
    if (!session) throw createError({ statusCode: 401, message: 'Invalid session' })

    await connectDB()
    const employee = await Employee.findById(session.id).select('gmailTokens').lean<any>()

    if (!employee?.gmailTokens) {
        throw createError({ statusCode: 400, message: 'Gmail not connected. Connect your Gmail from Profile settings.' })
    }

    const tokens = decryptTokens(employee.gmailTokens)
    if (!tokens) {
        throw createError({ statusCode: 400, message: 'Gmail tokens corrupted. Please reconnect your Gmail.' })
    }

    // Get valid access token (auto-refresh if expired)
    const { accessToken, refreshedTokens } = await getValidAccessToken(tokens)

    // If tokens were refreshed, update the DB
    if (refreshedTokens) {
        const merged = { ...tokens, ...refreshedTokens }
        await Employee.findByIdAndUpdate(session.id, {
            gmailTokens: encryptTokens(merged),
        })
    }

    const query = getQuery(event)
    const folder = (query.folder as string || 'INBOX').toUpperCase()
    const maxResults = Math.min(50, Math.max(1, Number(query.maxResults) || 20))
    const pageToken = query.pageToken as string || ''
    const search = query.q as string || ''

    // Build Gmail query
    let labelIds: string[] = []
    let gmailQuery = search

    switch (folder) {
        case 'INBOX': labelIds = ['INBOX']; break
        case 'SENT': labelIds = ['SENT']; break
        case 'DRAFT': labelIds = ['DRAFT']; break
        case 'TRASH': labelIds = ['TRASH']; break
        case 'STARRED': labelIds = ['STARRED']; break
        case 'SPAM': labelIds = ['SPAM']; break
        default: labelIds = ['INBOX']
    }

    try {
        // 1. List message IDs
        const params = new URLSearchParams()
        params.set('maxResults', String(maxResults))
        for (const lid of labelIds) params.append('labelIds', lid)
        if (pageToken) params.set('pageToken', pageToken)
        if (gmailQuery) params.set('q', gmailQuery)

        const listRes = await gmailFetch(accessToken, `/messages?${params}`)
        const messageIds: string[] = (listRes.messages || []).map((m: any) => m.id)

        if (messageIds.length === 0) {
            return {
                success: true,
                messages: [],
                nextPageToken: null,
                resultSizeEstimate: listRes.resultSizeEstimate || 0,
            }
        }

        // 2. Batch fetch message details (metadata + snippet)
        const messages = await Promise.all(
            messageIds.map(async (id) => {
                try {
                    const msg = await gmailFetch(accessToken, `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`)
                    return parseGmailMessage(msg)
                } catch {
                    return null
                }
            })
        )

        return {
            success: true,
            messages: messages.filter(Boolean),
            nextPageToken: listRes.nextPageToken || null,
            resultSizeEstimate: listRes.resultSizeEstimate || 0,
        }
    } catch (e: any) {
        console.error('[Gmail Messages Error]', e.message)
        throw createError({ statusCode: 502, message: 'Failed to fetch Gmail messages: ' + e.message })
    }
})
