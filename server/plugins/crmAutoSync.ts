import { logger } from '../utils/logger'
import { runCrmSync } from '../utils/runCrmSync'

/**
 * Background CRM auto-sync.
 *
 * Runs runCrmSync() on an interval so quote/appointment submissions show up
 * automatically — no "Sync" button, and no dependency on the inbound Gravity
 * Forms webhook (which cannot reach localhost).
 *
 * Enabled automatically in dev. On a long-running production server (a real
 * Node process, not serverless) set CRM_AUTOSYNC=true. On serverless (Vercel),
 * intervals don't survive between invocations — use GET /api/crm/cron-sync from
 * a scheduled job instead.
 */
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  const enabled = import.meta.dev || String(config.crmAutosync) === 'true'
  if (!enabled)
    return

  const minutes = Math.max(1, Number(config.crmAutosyncMinutes) || 30)
  const log = logger('[crmAutoSync]')
  let running = false

  async function tick() {
    if (running)
      return // never overlap runs
    running = true
    try {
      const res = await runCrmSync()
      if (res.synced > 0)
        log.info(`Added ${res.synced} new submission(s)`)
    }
    catch (e: any) {
      log.error('failed:', e?.message || e)
    }
    finally {
      running = false
    }
  }

  // First pass shortly after boot, then every N minutes.
  setTimeout(tick, 15_000)
  const timer = setInterval(tick, minutes * 60_000)
  // Don't keep the process alive solely for this timer.
  if (typeof (timer as any).unref === 'function')
    (timer as any).unref()

  log.info(`enabled — syncing every ${minutes} min`)
})
