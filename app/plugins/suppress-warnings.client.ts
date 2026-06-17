/**
 * Client-only plugin to suppress known harmless Vue warnings.
 * - <Suspense> experimental API warning (emitted by Nuxt internals)
 * - Vue Router "No match found for location with path /api/..." (caused by
 *   service-worker or browser-extension network fetches hitting the client router)
 * - "Invalid Teleport target on mount" — brief timing flicker during Nuxt
 *   client-side navigation when the teleport target hasn't rendered yet
 */
export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.client) {
    // ── Suppress known harmless Vue runtime warnings ──
    // The "trap-focus" warning comes from reka-ui's DialogContentModal passing
    // trap-focus to DialogContentImpl which renders a fragment (FocusScope +
    // DismissableLayer). This is an upstream reka-ui issue, not a bug in our code.
    nuxtApp.vueApp.config.warnHandler = (msg, _instance, _trace) => {
      if (msg.includes('Extraneous non-props attributes') && msg.includes('trap-focus'))
        return
      // Nuxt route transitions can briefly render non-element root nodes
      if (msg.includes('Component inside <Transition> renders non-element root node'))
        return
      // Let all other Vue warnings through to the console
      console.warn(`[Vue warn]: ${msg}`)
    }

    // ── Suppress known harmless console.warn messages ──
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
