/**
 * Gmail API Helper
 * Uses google-auth-library (already installed) for OAuth2 and raw REST for Gmail API.
 */
import { OAuth2Client } from 'google-auth-library'

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'

const SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.email',
]

export function getOAuth2Client(): OAuth2Client {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const baseUrl = process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    if (!clientId || !clientSecret) {
        throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env')
    }

    return new OAuth2Client(clientId, clientSecret, `${baseUrl}/api/gmail/callback`)
}

export function getAuthUrl(employeeId: string): string {
    const client = getOAuth2Client()
    return client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: SCOPES,
        state: employeeId, // Pass employee ID through OAuth flow
    })
}

export async function exchangeCodeForTokens(code: string) {
    const client = getOAuth2Client()
    const { tokens } = await client.getToken(code)
    return tokens
}

/** Refresh the access token if expired */
export async function getValidAccessToken(tokens: any): Promise<{ accessToken: string, refreshedTokens: any | null }> {
    const client = getOAuth2Client()
    client.setCredentials(tokens)

    // Check if access token is expired (or will expire in 5 minutes)
    const expiryDate = tokens.expiry_date || 0
    const isExpired = Date.now() >= expiryDate - 5 * 60 * 1000

    if (isExpired && tokens.refresh_token) {
        const { credentials } = await client.refreshAccessToken()
        return {
            accessToken: credentials.access_token!,
            refreshedTokens: credentials,
        }
    }

    return { accessToken: tokens.access_token, refreshedTokens: null }
}

/** Fetch from Gmail API with auth */
export async function gmailFetch(accessToken: string, path: string, options: any = {}) {
    const url = `${GMAIL_API}${path}`
    const res = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    })
    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Gmail API error ${res.status}: ${text}`)
    }
    return res.json()
}

/** Parse a Gmail message into a clean format */
export function parseGmailMessage(msg: any) {
    const headers = msg.payload?.headers || []
    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || ''

    // Extract body
    let body = ''
    let htmlBody = ''

    function extractBody(part: any) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
            body = Buffer.from(part.body.data, 'base64url').toString('utf8')
        }
        if (part.mimeType === 'text/html' && part.body?.data) {
            htmlBody = Buffer.from(part.body.data, 'base64url').toString('utf8')
        }
        if (part.parts) {
            for (const p of part.parts) extractBody(p)
        }
    }

    if (msg.payload) extractBody(msg.payload)

    // If no multipart, check direct body
    if (!body && !htmlBody && msg.payload?.body?.data) {
        body = Buffer.from(msg.payload.body.data, 'base64url').toString('utf8')
    }

    const from = getHeader('From')
    const fromMatch = from.match(/(?:"?([^"]*)"?\s)?(?:<)?([^>]+@[^>]+)(?:>)?/)

    return {
        id: msg.id,
        threadId: msg.threadId,
        snippet: msg.snippet || '',
        subject: getHeader('Subject'),
        from: from,
        fromName: fromMatch?.[1]?.trim() || fromMatch?.[2] || from,
        fromEmail: fromMatch?.[2] || from,
        to: getHeader('To'),
        date: getHeader('Date'),
        internalDate: msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : '',
        read: !msg.labelIds?.includes('UNREAD'),
        starred: msg.labelIds?.includes('STARRED') || false,
        labels: msg.labelIds || [],
        body,
        htmlBody,
    }
}
