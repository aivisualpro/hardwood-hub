/**
 * server/utils/logger.ts — Server-side structured logger
 *
 * In PRODUCTION  : only .warn() and .error() emit output.
 *                  .log() and .info() are no-ops.
 * In DEVELOPMENT : all levels emit with a [level] prefix.
 *
 * Usage:
 *   import { logger } from '../../utils/logger'
 *   const log = logger('[MyModule]')
 *   log.info('Starting sync')        // silenced in prod
 *   log.warn('Retrying...')          // always visible
 *   log.error('Failed', err)         // always visible
 *
 * NEVER pass request bodies, tokens, cookies, or full DB documents to any
 * log call — log only IDs, counts, and non-sensitive context strings.
 */

const IS_PROD = process.env.NODE_ENV === 'production'

export interface Logger {
    /** Silenced in production — use for verbose operational flow */
    log:   (...args: unknown[]) => void
    /** Silenced in production — same as log */
    info:  (...args: unknown[]) => void
    /** Always emits — use for recoverable anomalies */
    warn:  (...args: unknown[]) => void
    /** Always emits — use for actionable failures */
    error: (...args: unknown[]) => void
}

/**
 * Create a logger namespaced to a module.
 * @param prefix - e.g. '[Calendar Webhook]' — prepended to every message
 */
export function logger(prefix: string): Logger {
    return {
        log:   IS_PROD ? () => {} : (...a) => console.log(prefix,   ...a),
        info:  IS_PROD ? () => {} : (...a) => console.log(prefix,   ...a),
        warn:                       (...a) => console.warn(prefix,  ...a),
        error:                      (...a) => console.error(prefix, ...a),
    }
}

/**
 * Module-level default logger (no prefix).
 * Prefer logger('[ModuleName]') for contextual output.
 */
export const log = logger('')
