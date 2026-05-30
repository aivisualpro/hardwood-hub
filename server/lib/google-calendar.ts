/**
 * Google Calendar API Helper
 * Uses google-auth-library for OAuth2 and raw REST for Calendar API.
 * Follows the same pattern as server/lib/gmail.ts
 */
import { OAuth2Client } from 'google-auth-library'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

export function getCalendarOAuth2Client(): OAuth2Client {
  const clientId = process.env.GCAL_CLIENT_ID
  const clientSecret = process.env.GCAL_CLIENT_SECRET
  const baseUrl = process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  if (!clientId || !clientSecret) {
    throw new Error('GCAL_CLIENT_ID and GCAL_CLIENT_SECRET must be set in .env')
  }

  return new OAuth2Client(clientId, clientSecret, `${baseUrl}/api/google-calendar/callback`)
}

export function getCalendarAuthUrl(employeeId: string): string {
  const client = getCalendarOAuth2Client()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: employeeId,
  })
}

export async function exchangeCalendarCode(code: string) {
  const client = getCalendarOAuth2Client()
  const { tokens } = await client.getToken(code)
  return tokens
}

/** Refresh the access token if expired */
export async function getValidCalendarToken(tokens: any): Promise<{ accessToken: string, refreshedTokens: any | null }> {
  const client = getCalendarOAuth2Client()
  client.setCredentials(tokens)

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

/** Fetch from Google Calendar API with auth */
export async function calendarFetch(accessToken: string, path: string, options: any = {}) {
  const url = path.startsWith('http') ? path : `${CALENDAR_API}${path}`
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
    throw new Error(`Calendar API error ${res.status}: ${text}`)
  }
  return res.json()
}

/** Parse a Google Calendar event into a clean format */
export function parseCalendarEvent(event: any) {
  return {
    id: event.id,
    summary: event.summary || '',
    description: event.description || '',
    location: event.location || '',
    status: event.status || 'confirmed', // confirmed, tentative, cancelled
    htmlLink: event.htmlLink || '',
    // All-day events have 'date', timed events have 'dateTime'
    start: event.start?.dateTime || event.start?.date || '',
    startDate: event.start?.date || '',
    startTimeZone: event.start?.timeZone || '',
    end: event.end?.dateTime || event.end?.date || '',
    endDate: event.end?.date || '',
    endTimeZone: event.end?.timeZone || '',
    allDay: !!event.start?.date && !event.start?.dateTime,
    attendees: (event.attendees || []).map((a: any) => ({
      email: a.email,
      displayName: a.displayName || '',
      responseStatus: a.responseStatus || 'needsAction',
      self: a.self || false,
    })),
    organizer: {
      email: event.organizer?.email || '',
      displayName: event.organizer?.displayName || '',
      self: event.organizer?.self || false,
    },
    created: event.created || '',
    updated: event.updated || '',
    colorId: event.colorId || '',
    recurrence: event.recurrence || [],
    recurringEventId: event.recurringEventId || '',
  }
}

/** Build a Google Calendar event body from our app's format */
export function buildEventBody(data: {
  summary: string
  description?: string
  location?: string
  start: string
  end: string
  allDay?: boolean
  attendees?: { email: string }[]
  timeZone?: string
}) {
  const tz = data.timeZone || 'America/Detroit'
  const body: any = {
    summary: data.summary,
    description: data.description || '',
    location: data.location || '',
  }

  if (data.allDay) {
    // All-day events use 'date' (YYYY-MM-DD)
    body.start = { date: data.start.split('T')[0] }
    body.end = { date: data.end.split('T')[0] }
  }
  else {
    body.start = { dateTime: data.start, timeZone: tz }
    body.end = { dateTime: data.end, timeZone: tz }
  }

  if (data.attendees?.length) {
    body.attendees = data.attendees.map(a => ({ email: a.email }))
  }

  return body
}
