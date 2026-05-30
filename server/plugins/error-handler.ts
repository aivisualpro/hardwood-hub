/**
 * server/plugins/error-handler.ts — Global Nitro error handler
 *
 * Intercepts ALL unhandled errors from every API route and:
 *   1. Logs unexpected 5xx errors server-side (with full stack) for diagnostics
 *   2. Returns a sanitised, generic message to the client in production
 *      — no stack traces, no Mongoose internals, no e.message leakage
 *
 * 4xx errors are intentional createError() responses and are NOT logged here —
 * they are already well-shaped and logging every 401 (e.g. pre-login SSR
 * fetches) would flood the console with noise.
 *
 * In development the raw 5xx message is forwarded so errors are debuggable
 * without needing to open the server terminal.
 *
 * Ref: https://nitro.unjs.io/guide/error-handling#custom-error-handler
 */
import { logger } from '../utils/logger'

const log = logger('[ErrorHandler]')

const IS_PROD = process.env.NODE_ENV === 'production'

/** Status codes that are intentional — skip sanitisation and logging */
const CLIENT_ERROR_CODES = new Set([400, 401, 403, 404, 405, 409, 422, 429])

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('error', (error, { event }) => {
    const statusCode: number = (error as any).statusCode ?? 500

    // 4xx: deliberate createError() calls — pass through untouched, no logging
    if (CLIENT_ERROR_CODES.has(statusCode))
      return

    // 5xx: unexpected — log full detail server-side only
    log.error(
      `Unhandled ${statusCode} on ${event?.method ?? ''} ${event?.path ?? ''}:`,
      error,
    )

    if (!event)
      return // non-request context (startup hooks etc.)

    // Sanitise the response — strip raw internals in production
    const safeMessage = IS_PROD
      ? 'An internal error occurred. Please try again later.'
      : ((error as any).message ?? String(error))

        ;(error as any).message = safeMessage
    ;(error as any).statusMessage = safeMessage
    // Never leak a stack trace or raw DB error to the client
    delete (error as any).stack
    delete (error as any).data
  })
})
