import { decryptTokens, encryptTokens } from '../../lib/gmail-crypto'
import { calendarFetch, getValidCalendarToken } from '../../lib/google-calendar'
import { Employee } from '../../models/Employee'
import { connectDB } from '../../utils/mongoose'
import { rateLimit } from '../../utils/rateLimit'
import { logger } from '../../utils/logger'
const log = logger('[webhook.post]')
/**
 * POST /api/google-calendar/webhook — Receives push notifications from Google Calendar
 *
 * Google sends these headers:
 *   x-goog-channel-id     — The channel ID you created
 *   x-goog-resource-id    — The resource being watched
 *   x-goog-resource-state — 'sync' (initial), 'exists' (changed), 'not_exists' (deleted)
 *   x-goog-channel-token  — The secret token we passed when creating the watch channel
 *
 * IMPORTANT: Must respond 200 quickly; Google will retry on failure.
 * The webhook doesn't receive event data — just a notification that something changed.
 */

export default defineEventHandler(async (event) => {
  // H3: 100 push notifications per minute per IP — DoS protection
  rateLimit(event, { max: 100, windowMs: 60_000 })

  const channelId = getHeader(event, 'x-goog-channel-id') || ''
  const resourceId = getHeader(event, 'x-goog-resource-id') || ''
  const resourceState = getHeader(event, 'x-goog-resource-state') || ''
  const channelToken = getHeader(event, 'x-goog-channel-token') || ''

  log.info(`[Calendar Webhook] state=${resourceState} channel=${channelId} resource=${resourceId}`)

  // Initial sync confirmation — just acknowledge (can't verify token yet)
  if (resourceState === 'sync') {
    return { ok: true }
  }

  if (resourceState === 'exists') {
    // Something changed — find the employee with this channel
    try {
      await connectDB()
      const emp: any = await Employee.findOne({ calendarChannelId: channelId }).lean()

      if (!emp?.calendarTokens) {
        log.warn('[Calendar Webhook] No employee found for channel:', channelId)
        return { ok: true }
      }

      // ── Verify channel token ──────────────────────────────────────
      if (emp.calendarChannelToken && channelToken !== emp.calendarChannelToken) {
        log.warn('[Calendar Webhook] Token mismatch — rejecting spoofed notification')
        throw createError({ statusCode: 403, message: 'Invalid channel token' })
      }

      const tokens = decryptTokens(emp.calendarTokens)
      if (!tokens)
        return { ok: true }

      const { accessToken, refreshedTokens } = await getValidCalendarToken(tokens)

      // Update tokens if refreshed
      if (refreshedTokens) {
        await Employee.findByIdAndUpdate(emp._id, {
          calendarTokens: encryptTokens({ ...tokens, ...refreshedTokens }),
        })
      }

      // Perform incremental sync using syncToken if available
      if (emp.calendarSyncToken) {
        try {
          const params = new URLSearchParams({ syncToken: emp.calendarSyncToken })
          const data = await calendarFetch(accessToken, `/calendars/primary/events?${params}`)

          // Save the new syncToken
          if (data.nextSyncToken) {
            await Employee.findByIdAndUpdate(emp._id, {
              calendarSyncToken: data.nextSyncToken,
            })
          }

          log.info(`[Calendar Webhook] Synced ${data.items?.length || 0} changed events for ${emp.calendarEmail}`)
        }
        catch (syncError: any) {
          // If syncToken is invalid (410 Gone), clear it for next full sync
          if (syncError.message?.includes('410')) {
            await Employee.findByIdAndUpdate(emp._id, { calendarSyncToken: '' })
            log.warn('[Calendar Webhook] SyncToken expired, cleared for next full sync')
          }
        }
      }
    }
    catch (e: any) {
      // Re-throw 403 for spoofed tokens
      if (e?.statusCode === 403) throw e
      log.error('[Calendar Webhook] Error processing notification:', e)
    }
  }

  // Always return 200 quickly
  return { ok: true }
})

