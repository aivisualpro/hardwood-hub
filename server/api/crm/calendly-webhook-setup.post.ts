/**
 * POST /api/crm/calendly-webhook-setup
 * One-time setup: registers a Calendly webhook subscription so new
 * bookings / cancellations are pushed to /api/crm/webhook in real-time.
 *
 * Call this once after deployment. It will:
 * 1. Discover the Calendly organization URI
 * 2. Check for existing webhook subscriptions (avoids duplicates)
 * 3. Register a new webhook subscription if none exists
 */
import { Buffer } from 'node:buffer'

const WEBHOOK_CALLBACK_URL = 'https://www.a2hardwood.com/api/crm/webhook'
const WEBHOOK_EVENTS = ['invitee.created', 'invitee.canceled']

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const token = config.calendlyAccessToken

  if (!token) {
    return { success: false, error: 'No CALENDLY_ACCESS_TOKEN configured' }
  }

  // 1. Get user URI from JWT
  const parts = token.split('.')
  if (parts.length < 2) return { success: false, error: 'Invalid token format' }

  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'))
  const userUuid = payload.user_uuid
  if (!userUuid) return { success: false, error: 'Could not find user_uuid in token' }

  const userUri = `https://api.calendly.com/users/${userUuid}`
  console.log('[Calendly Webhook Setup] User URI:', userUri)

  // 2. Discover organization URI
  let organizationUri = ''

  // Method 1: Try /organization_memberships
  try {
    const res = await fetch(
      `https://api.calendly.com/organization_memberships?user=${encodeURIComponent(userUri)}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
    if (res.ok) {
      const data = await res.json()
      const orgUri = data.collection?.[0]?.organization
      if (typeof orgUri === 'string') {
        organizationUri = orgUri
      } else if (orgUri?.uri) {
        organizationUri = orgUri.uri
      }
      console.log('[Calendly Webhook Setup] Org from memberships:', organizationUri)
    } else {
      console.warn('[Calendly Webhook Setup] /organization_memberships failed:', res.status)
    }
  } catch (e: any) {
    console.warn('[Calendly Webhook Setup] /organization_memberships error:', e.message)
  }

  // Method 2: Try to extract from event_types response
  if (!organizationUri) {
    try {
      const res = await fetch(
        `https://api.calendly.com/event_types?user=${encodeURIComponent(userUri)}&count=1`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      )
      if (res.ok) {
        const data = await res.json()
        const et = data.collection?.[0]
        // Some responses include organization at the top level
        if (et?.organization) {
          organizationUri = et.organization
        }
        // Or embedded in profile.owner — for individual accounts this IS the org
        else if (et?.profile?.owner) {
          // For individual users, the org URI follows the same pattern
          // Try extracting from the profile owner
          const ownerUri = et.profile.owner
          if (ownerUri.includes('/organizations/')) {
            organizationUri = ownerUri
          }
        }
        console.log('[Calendly Webhook Setup] Org from event_types:', organizationUri)
      }
    } catch (e: any) {
      console.warn('[Calendly Webhook Setup] event_types fallback error:', e.message)
    }
  }

  if (!organizationUri) {
    return {
      success: false,
      error: 'Could not discover organization URI. The PAT token may need the users:read scope. You can regenerate it at https://calendly.com/integrations/api_webhooks',
      userUri,
    }
  }

  // 3. Check for existing webhook subscriptions (avoid duplicates)
  try {
    const res = await fetch(
      `https://api.calendly.com/webhook_subscriptions?organization=${encodeURIComponent(organizationUri)}&user=${encodeURIComponent(userUri)}&scope=user`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
    if (res.ok) {
      const data = await res.json()
      const existing = data.collection?.find(
        (w: any) => w.callback_url === WEBHOOK_CALLBACK_URL && w.state === 'active'
      )
      if (existing) {
        console.log('[Calendly Webhook Setup] Webhook already registered:', existing.uri)
        return {
          success: true,
          message: 'Webhook already registered and active',
          webhookUri: existing.uri,
          callbackUrl: existing.callback_url,
          events: existing.events,
        }
      }
    }
  } catch (e: any) {
    console.warn('[Calendly Webhook Setup] List check error:', e.message)
  }

  // 4. Register new webhook subscription
  const createRes = await fetch('https://api.calendly.com/webhook_subscriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: WEBHOOK_CALLBACK_URL,
      events: WEBHOOK_EVENTS,
      organization: organizationUri,
      user: userUri,
      scope: 'user',
    }),
  })

  const result = await createRes.json()

  if (!createRes.ok) {
    console.error('[Calendly Webhook Setup] Registration failed:', JSON.stringify(result))
    return {
      success: false,
      error: `Webhook registration failed (${createRes.status})`,
      details: result,
    }
  }

  console.log('[Calendly Webhook Setup] ✅ Webhook registered successfully!')
  return {
    success: true,
    message: 'Webhook registered successfully! New Calendly bookings will now sync automatically.',
    webhook: result.resource || result,
    callbackUrl: WEBHOOK_CALLBACK_URL,
    events: WEBHOOK_EVENTS,
  }
})
