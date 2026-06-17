import crypto from 'node:crypto'
import type { ICrmSubmission } from '../../models/CrmSubmission'
import { CrmSubmission } from '../../models/CrmSubmission'
import { parseGFEntry } from '../../utils/gfFieldMapping'
import { gfGetForm } from '../../utils/gravityForms'
import { logActivity } from '../../utils/logActivity'
import { connectDB } from '../../utils/mongoose'
import { rateLimit } from '../../utils/rateLimit'
import { logger } from '../../utils/logger'
const log = logger('[webhook.post]')

/**
 * Verify HMAC-SHA256 signature from the `x-webhook-signature` header.
 * The Gravity Forms Webhooks add-on (or any upstream proxy) should send:
 *   x-webhook-signature: sha256=<hex-encoded HMAC of the raw JSON body>
 *
 * If CRM_WEBHOOK_SECRET is not configured, verification is skipped with a warning.
 */
function verifyCrmWebhook(event: any, rawBody: string): void {
  const config = useRuntimeConfig()
  const token = (config.crmWebhookToken as string) || ''
  const secret = (config.crmWebhookSecret as string) || ''

  // 1) Static shared-token header — works with the Gravity Forms Webhooks add-on,
  //    which can only send FIXED header values (it can't HMAC the body).
  //    In GF add a request header:  X-Webhook-Token: <CRM_WEBHOOK_TOKEN>
  if (token) {
    const auth = getHeader(event, 'authorization') || ''
    const provided = (getHeader(event, 'x-webhook-token') || '') || auth.replace(/^Bearer\s+/i, '')
    if (provided !== token) {
      throw createError({ statusCode: 403, message: 'Invalid or missing webhook token' })
    }
    return
  }

  // 2) HMAC-SHA256 fallback for upstreams/proxies that CAN sign the raw body:
  //    x-webhook-signature: sha256=<hex>
  if (secret) {
    const sigHeader = getHeader(event, 'x-webhook-signature') || ''
    if (!sigHeader) {
      throw createError({ statusCode: 403, message: 'Missing x-webhook-signature header' })
    }
    const provided = sigHeader.startsWith('sha256=') ? sigHeader.slice(7) : sigHeader
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    const a = Buffer.from(provided, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw createError({ statusCode: 403, message: 'Invalid webhook signature' })
    }
    return
  }

  // 3) Neither configured → skip (INSECURE — local dev only).
  log.warn('CRM webhook auth DISABLED — set CRM_WEBHOOK_TOKEN to secure it')
}
/**
 * POST /api/crm/webhook
 * Real-time sync from Gravity Forms.
 * 
 * To use this: 
 * 1. Install "Gravity Forms Webhooks" Add-on in WordPress.
 * 2. Go to Form Settings → Webhooks and add a new webhook.
 * 3. Set Request URL to: https://your-domain.com/api/crm/webhook
 * 4. Set Request Method to: POST
 * 5. Set Format to: JSON
 */

export default defineEventHandler(async (event) => {
  // H3: 100 webhook calls per minute per IP — DoS protection
  rateLimit(event, { max: 100, windowMs: 60_000 })
  await connectDB()

  // Read raw body for HMAC verification, then parse
  const rawBody = await readRawBody(event, 'utf-8') || ''
  verifyCrmWebhook(event, rawBody)
  const entry = JSON.parse(rawBody || '{}')

  // 1. Calendly Webhook Integration
  if (entry?.event && entry.event.startsWith('invitee.')) {
    log.info(`[CRM Webhook] Received Calendly webhook: ${entry.event}`)
    // Use lightweight Calendly-only sync instead of full GF sync
    $fetch('/api/crm/calendly-sync', { method: 'POST' }).catch(e => log.error('Calendly webhook sync failed:', e))
    return { success: true, message: 'Calendly sync triggered' }
  }

  // 2. Gravity Forms Validation
  if (!entry || !entry.id || !entry.form_id) {
    throw createError({ statusCode: 400, message: 'Invalid payload: Not recognized as Gravity Forms or Calendly webhook' })
  }

  const formId = Number(entry.form_id)

  try {
    // Fetch form definition to get correct field labels for parsing
    const form = await gfGetForm(formId)
    const formFields = form?.fields || []

    // Parse using our canonical mapping logic
    const parsed = parseGFEntry(entry, formFields)

    // Upsert into MongoDB
    const result = await CrmSubmission.findOneAndUpdate(
      { gfEntryId: parsed.gfEntryId },
      { $set: parsed },
      { upsert: true, new: true, lean: true },
    ) as ICrmSubmission | null

    // Log Activity for new lead
    await logActivity({
      user: 'Gravity Forms',
      action: 'create',
      module: 'crm',
      description: `New submission: ${parsed.formName} (from ${parsed.name || 'Anonymous'})`,
      targetId: result?._id?.toString(),
      targetName: parsed.name || parsed.formName,
      metadata: {
        formId,
        entryId: entry.id,
      },
    })

    log.info(`[CRM Webhook] Synced entry #${entry.id} from Form #${entry.form_id} (${parsed.formName})`)

    return {
      success: true,
      id: result?._id,
      gfEntryId: entry.id,
      action: result ? 'sync' : 'ignored',
    }
  }
  catch (err: any) {
    log.error(`[CRM Webhook Error] Form ${formId}:`, err.message)
    throw createError({
      statusCode: 500,
      message: `Failed to sync webhook entry: ${err.message}`,
    })
  }
})
