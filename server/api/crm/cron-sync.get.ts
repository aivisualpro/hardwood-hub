import { runCrmSync } from '../../utils/runCrmSync'

/**
 * GET /api/crm/cron-sync — trigger the CRM sync from an external scheduler
 * (Vercel Cron, cron-job.org, GitHub Actions, etc.) in environments where the
 * in-process auto-sync interval can't run (e.g. serverless).
 *
 * Whitelisted in 02.apiAuth.ts (no user session) — auth is the shared secret:
 *   Authorization: Bearer <CRM_CRON_SECRET>     ← Vercel Cron sends this automatically
 *   ?key=<CRM_CRON_SECRET>
 */
export default defineEventHandler(async (event) => {
  const secret = (useRuntimeConfig().crmCronSecret as string) || ''
  if (!secret)
    throw createError({ statusCode: 503, message: 'CRM_CRON_SECRET is not configured' })

  const auth = getHeader(event, 'authorization') || ''
  const provided = auth.replace(/^Bearer\s+/i, '') || (getQuery(event).key as string) || ''
  if (provided !== secret)
    throw createError({ statusCode: 401, message: 'Invalid cron secret' })

  return await runCrmSync()
})
