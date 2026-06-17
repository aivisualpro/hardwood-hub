import { runCrmSync } from '../../utils/runCrmSync'

/**
 * POST /api/crm/sync — manual "Sync" button on the Quotes/CRM pages.
 * Pulls all Gravity Forms entries + Calendly appointments into MongoDB.
 *
 * Permission is enforced upstream by server/middleware/03.permissions.ts
 * (/api/crm → /crm/pipeline). The actual work lives in utils/runCrmSync so the
 * background auto-sync plugin and the cron endpoint can reuse it.
 */
export default defineEventHandler(async () => {
  return await runCrmSync()
})
