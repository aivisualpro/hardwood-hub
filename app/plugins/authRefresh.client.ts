/**
 * Nuxt plugin: session refresh
 *
 * 1. Wraps global $fetch: when any API call returns 401, silently POST
 *    /api/auth/refresh once and RETRY the original request, returning the
 *    retry's result to the caller. (The previous onResponseError approach
 *    could not do this — ofetch interceptors cannot replace a failed
 *    response, so the original promise still rejected and the UI showed
 *    an error even though the background retry succeeded.)
 *
 * 2. Proactively refreshes the access token every 45 minutes and whenever
 *    the tab becomes visible again. This keeps the hardwood_session cookie
 *    (1 h maxAge) fresh for requests that DON'T go through $fetch — e.g.
 *    @vercel/blob client uploads, which use their own fetch and were
 *    failing with 401 after ~1 hour idle (the intermittent estimate PDF
 *    upload bug).
 *
 * Client-only — on the server side the middleware handles auth.
 */
export default defineNuxtPlugin(() => {
  const originalFetch = globalThis.$fetch

  // Single-flight refresh — concurrent 401s share one refresh round-trip
  let refreshPromise: Promise<void> | null = null

  function refreshSession(): Promise<void> {
    if (!refreshPromise) {
      refreshPromise = originalFetch('/api/auth/refresh', { method: 'POST' })
        .then(async () => {
          // Repopulate auth state so sidebar/nav are correct
          const { fetchUser } = useAuth()
          await fetchUser().catch(() => {})
        })
        .finally(() => {
          refreshPromise = null
        })
    }
    return refreshPromise
  }

  function is401(err: any): boolean {
    return (err?.response?.status ?? err?.statusCode ?? err?.status) === 401
  }

  const wrappedFetch = (async (request: any, options?: any) => {
    try {
      return await originalFetch(request, options)
    }
    catch (err: any) {
      // Only intercept 401s on API routes; ignore auth endpoints to avoid loops
      if (
        !is401(err)
        || typeof request !== 'string'
        || !request.startsWith('/api/')
        || request.startsWith('/api/auth/')
      ) {
        throw err
      }

      try {
        await refreshSession()
      }
      catch {
        // Refresh failed — force re-login
        await navigateTo('/login')
        throw err
      }

      // Retry the original request once and return ITS result to the caller
      return await originalFetch(request, options)
    }
  }) as typeof globalThis.$fetch

  // Preserve ofetch statics used elsewhere in the app
  wrappedFetch.raw = originalFetch.raw
  wrappedFetch.native = originalFetch.native
  wrappedFetch.create = originalFetch.create

  globalThis.$fetch = wrappedFetch

  // ── Proactive refresh ────────────────────────────────────────────────
  function proactiveRefresh() {
    const { user } = useAuth()
    if (user.value)
      refreshSession().catch(() => {})
  }

  // Every 45 min (access token lives 60 min)
  setInterval(proactiveRefresh, 45 * 60 * 1000)

  // When the user returns to a backgrounded tab (e.g. next morning)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible')
      proactiveRefresh()
  })
})
