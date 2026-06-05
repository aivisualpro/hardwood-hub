/**
 * Client-only plugin to suppress known harmless Vue warnings.
 * - <Suspense> experimental API warning (emitted by Nuxt internals)
 * - Vue Router "No match found for location with path /api/..." (caused by
 *   service-worker or browser-extension network fetches hitting the client router)
 * - "Invalid Teleport target on mount" — brief timing flicker during Nuxt
 *   client-side navigation when the teleport target hasn't rendered yet
 */
export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    const origWarn = console.warn
    console.warn = (...args: any[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : ''
      if (msg.includes('<Suspense> is an experimental feature'))
        return
      if (msg.includes('No match found for location with path') && msg.includes('/api/'))
        return
      if (msg.includes('Invalid Teleport target on mount'))
        return
      origWarn.apply(console, args)
    }
  }
})
