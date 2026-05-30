/**
 * Nuxt plugin: $fetch 401 interceptor
 *
 * When any API call returns 401, silently try POST /api/auth/refresh once.
 * If the refresh succeeds, the server sets a new hardwood_session cookie and
 * we retry the original request.  If the refresh also fails, we redirect to /login.
 *
 * This is client-only — on the server side the middleware handles auth.
 */
export default defineNuxtPlugin(() => {
  const refreshing = ref(false)

  const originalFetch = globalThis.$fetch

  // @ts-ignore — augmenting global $fetch
  globalThis.$fetch = $fetch.create({
    onResponseError: async ({ request, options, response }) => {
      // Only intercept 401s on API routes; ignore auth endpoints to avoid loops
      if (
        response.status !== 401
        || typeof request !== 'string'
        || !request.startsWith('/api/')
        || request.startsWith('/api/auth/')
      ) {
        return
      }

      // Prevent concurrent refresh attempts
      if (refreshing.value)
        return
      refreshing.value = true

      try {
        await $fetch('/api/auth/refresh', { method: 'POST' })

        // Refresh succeeded — repopulate auth state so sidebar/nav are correct
        const { fetchUser } = useAuth()
        fetchUser().catch(() => {})

        // Retry the original request once
        await $fetch(request, options as Parameters<typeof $fetch>[1])
      }
      catch {
        // Refresh failed — force re-login
        await navigateTo('/login')
      }
      finally {
        refreshing.value = false
      }
    },
  })
})
