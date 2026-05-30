/**
 * Nuxt plugin: populate auth state on every page load
 *
 * Runs on both server (SSR) and client (hard reloads, deep links).
 * Calls fetchUser() once — the result is serialised into the Nuxt payload
 * and hydrated on the client, so there's no duplicate fetch on CSR.
 *
 * This ensures the sidebar, middleware, and all composables see a valid
 * user on first paint — no "second refresh" required.
 */
export default defineNuxtPlugin(async () => {
  const { user, fetchUser } = useAuth()

  // Only fetch if not already populated (avoids redundant calls during CSR navigation)
  if (!user.value) {
    await fetchUser()
  }
})
