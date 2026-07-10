// Utility to sync Calendly appointments
import { Buffer } from 'node:buffer'
import { logger } from './logger'
const log = logger('[Calendly]')

const BATCH_SIZE = 2 // concurrent invitee requests per batch
const BATCH_DELAY_MS = 1500 // delay between batches
const MAX_RETRIES = 3 // retries for 429 errors

// Global sync lock to prevent concurrent syncs from piling up
let isSyncing = false

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Classify a Calendly event/service name into an appointment type.
 * e.g. "Free Phone Consultation" → 'phone', "In-Home Appointment" → 'in-home'
 */
export function classifyAppointmentType(name: string): 'phone' | 'in-home' | '' {
  const n = (name || '').toLowerCase()
  if (/in[\s-]?home/.test(n))
    return 'in-home'
  if (/phone|call|consult/.test(n))
    return 'phone'
  return ''
}

async function fetchWithRetry(url: string, headers: Record<string, string>, retries = MAX_RETRIES): Promise<Response | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, { headers })
    if (res.ok)
      return res
    if (res.status === 429) {
      const retryAfter = Number.parseInt(res.headers.get('retry-after') || '0') || (2 ** attempt) * 3
      log.warn(`Rate limited, waiting ${retryAfter}s (attempt ${attempt + 1}/${retries})`)
      await sleep(retryAfter * 1000)
      continue
    }
    log.warn(`Fetch failed for ${url}: ${res.status}`)
    return null
  }
  log.warn(`Gave up after ${retries} retries: ${url}`)
  return null
}

/**
 * Fetch Calendly appointments.
 * @param recentOnly If true (default), only fetch events from the last 30 days.
 *                   Set to false for a full historical sync.
 */
export async function fetchCalendlyAppointments(recentOnly = true) {
  // Prevent concurrent syncs from piling up
  if (isSyncing) {
    log.info('Sync already in progress, skipping')
    return []
  }
  isSyncing = true

  try {
    return await _doFetch(recentOnly)
  }
  finally {
    isSyncing = false
  }
}

async function _doFetch(recentOnly: boolean) {
  const config = useRuntimeConfig()
  const token = config.calendlyAccessToken

  if (!token) {
    throw new Error('Missing Calendly Access Token')
  }

  // Decode user UUID from the PAT token payload
  const parts = token.split('.')
  if (parts.length < 2)
    throw new Error('Invalid token format')

  const payloadStr = Buffer.from(parts[1]!, 'base64').toString('utf-8')
  const payload = JSON.parse(payloadStr)

  const userUuid = payload.user_uuid
  if (!userUuid)
    throw new Error('Could not find user_uuid in Calendly token')

  const userUri = `https://api.calendly.com/users/${userUuid}`
  const headers = { Authorization: `Bearer ${token}` }

  // Date range: only recent events to minimize API calls
  const minDate = recentOnly
    ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // last 30 days
    : undefined
  // Include future events too (upcoming appointments)
  const maxDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

  log.info(`Starting sync (recentOnly=${recentOnly}, since=${minDate || 'all'})`)

  // Fetch scheduled events
  const allEvents: any[] = []

  for (const status of ['active', 'canceled']) {
    let nextPageUrl: string | null = null
    let page = 0

    do {
      page++
      let url = ''

      if (nextPageUrl) {
        url = nextPageUrl
      }
      else {
        const params = new URLSearchParams({
          user: userUri,
          status,
          count: '100',
          sort: 'start_time:desc',
        })
        if (minDate)
          params.set('min_start_time', minDate)
        params.set('max_start_time', maxDate)
        url = `https://api.calendly.com/scheduled_events?${params.toString()}`
      }

      log.info(`Fetching events (status=${status}, page=${page})`)

      const eventsRes = await fetchWithRetry(url, headers)

      if (!eventsRes) {
        log.error(`Events fetch failed for status=${status}, page=${page}`)
        break
      }

      const eventsData = await eventsRes.json()
      const events = eventsData.collection || []
      log.info(`Got ${events.length} events (status=${status}, page=${page})`)

      for (const event of events) {
        allEvents.push({ event, status })
      }

      nextPageUrl = eventsData.pagination?.next_page || null

      if (nextPageUrl)
        await sleep(1000)
    } while (nextPageUrl)
  }

  log.info(`Total events: ${allEvents.length}, fetching invitees in batches of ${BATCH_SIZE}...`)

  // Process invitees in small batches
  const allAppointments: any[] = []

  for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
    const batch = allEvents.slice(i, i + BATCH_SIZE)

    const results = await Promise.all(batch.map(async ({ event, status }) => {
      const inviteesRes = await fetchWithRetry(`${event.uri}/invitees`, headers)
      if (!inviteesRes)
        return []

      const inviteesData = await inviteesRes.json()
      const invitees = inviteesData.collection || []

      return invitees.map((invitee: any) => {
        const fields: Record<string, string> = {}
        let address = ''
        let city = ''
        let state = ''
        let zip = ''
        let phone = invitee.text_reminder_number || ''
        let details = ''

        if (invitee.questions_and_answers) {
          for (const qa of invitee.questions_and_answers) {
            const q = qa.question.toLowerCase()
            fields[qa.question] = qa.answer

            if (q.includes('street address') || q.includes('street_address')) {
              address = qa.answer
            }
            else if (q.includes('address') && !address) {
              address = qa.answer
            }
            else if (q.includes('city')) {
              city = qa.answer
            }
            else if (q.includes('state')) {
              state = qa.answer
            }
            else if (q.includes('zip') || q.includes('postal')) {
              zip = qa.answer
            }
            else if (q.includes('phone')) {
              phone = qa.answer
            }
            else if (q.includes('prepare') || q.includes('anything') || q.includes('message')) {
              details = qa.answer
            }
          }
        }

        // Calendly marks the ORIGINAL invitee with rescheduled=true when the
        // client reschedules (the new booking arrives as a separate event).
        const isCanceled = invitee.status === 'canceled' || status === 'canceled'
        const isRescheduled = invitee.rescheduled === true

        return {
          gfEntryId: invitee.uri.split('/').pop(),
          gfFormId: 0,
          formName: event.name || 'Calendly Appointment',
          type: 'appointment',
          status: isCanceled ? 'archived' : 'new',
          name: invitee.name || `${invitee.first_name || ''} ${invitee.last_name || ''}`.trim(),
          firstName: invitee.first_name || '',
          lastName: invitee.last_name || '',
          email: invitee.email || '',
          phone,
          address,
          city,
          state,
          zip,
          message: details,
          fields: {
            ...fields,
            appointmentType: classifyAppointmentType(event.name),
            meetingScheduled: {
              startTime: new Date(event.start_time),
              endTime: new Date(event.end_time),
              rescheduleUrl: invitee.reschedule_url,
              cancelUrl: invitee.cancel_url,
              eventStatus: isCanceled ? 'canceled' : 'active',
              rescheduled: isRescheduled,
            },
          },
          dateSubmitted: new Date(invitee.created_at),
          dateUpdated: invitee.updated_at ? new Date(invitee.updated_at) : undefined,
          sourceUrl: '',
          ip: '',
        }
      })
    }))

    for (const r of results) {
      allAppointments.push(...r)
    }

    // Delay between batches
    if (i + BATCH_SIZE < allEvents.length) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  log.info(`Total appointments fetched: ${allAppointments.length}`)
  return allAppointments
}
