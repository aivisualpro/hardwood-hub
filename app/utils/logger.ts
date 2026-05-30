/**
 * app/utils/logger.ts — Client-side logger
 *
 * In PRODUCTION  : only .warn() and .error() emit output.
 *                  .log() and .info() are no-ops — keeps the browser console
 *                  clean for end users and prevents accidental data leakage.
 * In DEVELOPMENT : all levels pass through to the native console.
 *
 * Usage (in .vue / composables):
 *   import { logger } from '~/utils/logger'
 *   const log = logger('[useKanban]')
 *   log.info('Fetching tasks')    // silent in prod
 *   log.error('Fetch failed', e)  // always shown
 *
 * NEVER pass response bodies, auth tokens, or user PII to any log call.
 */

const IS_PROD = import.meta.env.PROD

export interface Logger {
  log: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

export function logger(prefix: string): Logger {
  return {
    log: IS_PROD ? () => {} : (...a) => console.log(prefix, ...a),
    info: IS_PROD ? () => {} : (...a) => console.log(prefix, ...a),
    warn: (...a) => console.warn(prefix, ...a),
    error: (...a) => console.error(prefix, ...a),
  }
}

export const log = logger('')
