// Utility to sync Calendly appointments
import { Buffer } from 'node:buffer'

export async function fetchCalendlyAppointments() {
  const config = useRuntimeConfig()
  const token = config.calendlyAccessToken

  if (!token) {
    throw new Error('Missing Calendly Access Token')
  }

  // Decode UUID from token manually
  const parts = token.split('.')
  if (parts.length < 2) throw new Error('Invalid token format')
  
  const payloadStr = Buffer.from(parts[1], 'base64').toString('utf-8')
  const payload = JSON.parse(payloadStr)
  
  const userUuid = payload.user_uuid
  if (!userUuid) throw new Error('Could not find user_uuid in Calendly token')
  
  const userUri = `https://api.calendly.com/users/${userUuid}`
  console.log('[Calendly] User URI:', userUri)
  
  // Fetch ALL scheduled events (active + canceled) to get complete history
  const allAppointments: any[] = []
  
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
      console.log(`[Calendly] Fetching events (status=${status}, page=${page}):`, url)
      
      const eventsRes = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (!eventsRes.ok) {
        const text = await eventsRes.text()
        console.error(`[Calendly] Events fetch failed (${eventsRes.status}):`, text)
        throw new Error(`Calendly events fetch failed (${eventsRes.status}): ${text}`)
      }
      
      const eventsData = await eventsRes.json()
      const events = eventsData.collection || []
      console.log(`[Calendly] Got ${events.length} events (status=${status}, page=${page})`)
      
      // Process each event's invitees
      for (const event of events) {
        const inviteesRes = await fetch(`${event.uri}/invitees`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        
        if (!inviteesRes.ok) {
          console.warn(`[Calendly] Invitees fetch failed for event ${event.uri}:`, inviteesRes.status)
          continue
        }
        
        const inviteesData = await inviteesRes.json()
        const invitees = inviteesData.collection || []
        
        for (const invitee of invitees) {
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

          allAppointments.push({
            gfEntryId: invitee.uri.split('/').pop(), // Use invitee UUID to avoid duplicates
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
          })
        }
      }
      
      // Check for next page
      nextPageToken = eventsData.pagination?.next_page_token || null
    } while (nextPageToken)
  }
  
  console.log(`[Calendly] Total appointments fetched: ${allAppointments.length}`)
  return allAppointments
}
