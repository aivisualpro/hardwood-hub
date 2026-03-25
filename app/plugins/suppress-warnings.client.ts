/**
 * Client-only plugin to suppress known harmless Vue warnings.
 * - <Suspense> experimental API warning (emitted by Nuxt internals)
 */
export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    const origWarn = console.warn
    console.warn = (...args: any[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : ''
      if (msg.includes('<Suspense> is an experimental feature')) return
      origWarn.apply(console, args)
    }
  }
})
