// Utility to sync Calendly appointments
import { Buffer } from 'node:buffer'

const BATCH_SIZE = 5        // concurrent invitee requests per batch
const BATCH_DELAY_MS = 1000 // delay between batches
const MAX_RETRIES = 3       // retries for 429 errors

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithRetry(url: string, headers: Record<string, string>, retries = MAX_RETRIES): Promise<Response | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, { headers })
    if (res.ok) return res
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') || '0') || (2 ** attempt) * 2
      console.warn(`[Calendly] Rate limited, waiting ${retryAfter}s (attempt ${attempt + 1}/${retries})`)
      await sleep(retryAfter * 1000)
      continue
    }
    console.warn(`[Calendly] Fetch failed for ${url}: ${res.status}`)
    return null
  }
  console.warn(`[Calendly] Gave up after ${retries} retries: ${url}`)
  return null
}

export async function fetchCalendlyAppointments() {
  const config = useRuntimeConfig()
  const token = config.calendlyAccessToken

  if (!token) {
    throw new Error('Missing Calendly Access Token')
  }

  // Decode user UUID from the PAT token payload
  // Note: /users/me requires `users:read` scope which this PAT doesn't have,
  // so we extract the UUID directly from the JWT instead.
  const parts = token.split('.')
  if (parts.length < 2) throw new Error('Invalid token format')
  
  const payloadStr = Buffer.from(parts[1], 'base64').toString('utf-8')
  const payload = JSON.parse(payloadStr)
  
  const userUuid = payload.user_uuid
  if (!userUuid) throw new Error('Could not find user_uuid in Calendly token')
  
  const userUri = `https://api.calendly.com/users/${userUuid}`
  console.log('[Calendly] User URI:', userUri)
  
  // Fetch ALL scheduled events (active + canceled) to get complete history
  const allEvents: any[] = []
  const headers = { 'Authorization': `Bearer ${token}` }
  
  for (const status of ['active', 'canceled']) {
    let nextPageToken: string | null = null
    let page = 0
    
    do {
      page++
      const params = new URLSearchParams({
        user: userUri,
        status,
        count: '100',
        sort: 'start_time:desc',
      })
      if (nextPageToken) params.set('page_token', nextPageToken)
      
      const url = `https://api.calendly.com/scheduled_events?${params.toString()}`
      console.log(`[Calendly] Fetching events (status=${status}, page=${page})`)
      
      const eventsRes = await fetchWithRetry(url, headers)
      
      if (!eventsRes) {
        console.error(`[Calendly] Events fetch failed for status=${status}, page=${page}`)
        break
      }
      
      const eventsData = await eventsRes.json()
      const events = eventsData.collection || []
      console.log(`[Calendly] Got ${events.length} events (status=${status}, page=${page})`)
      
      for (const event of events) {
        allEvents.push({ event, status })
      }
      
      // Check for next page
      nextPageToken = eventsData.pagination?.next_page_token || null
      
      // Small delay between event pages to avoid rate limits
      if (nextPageToken) await sleep(500)
    } while (nextPageToken)
  }
  
  console.log(`[Calendly] Total events collected: ${allEvents.length}, fetching invitees in batches of ${BATCH_SIZE}...`)
  
  // Process invitees in batches to avoid rate limits
  const allAppointments: any[] = []
  
  for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
    const batch = allEvents.slice(i, i + BATCH_SIZE)
    
    const results = await Promise.all(batch.map(async ({ event, status }) => {
      const inviteesRes = await fetchWithRetry(`${event.uri}/invitees`, headers)
      if (!inviteesRes) return []
      
      const inviteesData = await inviteesRes.json()
      const invitees = inviteesData.collection || []
      
      return invitees.map((invitee: any) => {
        // Map questions and answers
        const fields: Record<string, string> = {}
        let address = ''
        let details = ''

        if (invitee.questions_and_answers) {
          for (const qa of invitee.questions_and_answers) {
            const q = qa.question.toLowerCase()
            fields[qa.question] = qa.answer
            
            if (q.includes('address')) {
              address = qa.answer
            } else if (q.includes('prepare') || q.includes('anything') || q.includes('message')) {
              details = qa.answer
            }
          }
        }

        return {
          gfEntryId: invitee.uri.split('/').pop(),
          gfFormId: 0,
          formName: event.name || 'Calendly Appointment',
          type: 'appointment',
          status: invitee.status === 'canceled' || status === 'canceled' ? 'archived' : 'new',
          name: invitee.name || `${invitee.first_name || ''} ${invitee.last_name || ''}`.trim(),
          firstName: invitee.first_name || '',
          lastName: invitee.last_name || '',
          email: invitee.email || '',
          phone: invitee.text_reminder_number || '',
          address,
          city: '',
          state: '',
          zip: '',
          message: details,
          fields: {
            ...fields,
            meetingScheduled: {
              startTime: new Date(event.start_time),
              endTime: new Date(event.end_time),
              rescheduleUrl: invitee.reschedule_url,
              cancelUrl: invitee.cancel_url,
              eventStatus: status,
            }
          },
          dateSubmitted: new Date(invitee.created_at),
          dateUpdated: invitee.updated_at ? new Date(invitee.updated_at) : undefined,
          sourceUrl: '',
          ip: '',
        }
      })
    }))
    
    for (const batch of results) {
      allAppointments.push(...batch)
    }
    
    // Delay between batches
    if (i + BATCH_SIZE < allEvents.length) {
      await sleep(BATCH_DELAY_MS)
    }
  }
  
  console.log(`[Calendly] Total appointments fetched: ${allAppointments.length}`)
  return allAppointments
}
