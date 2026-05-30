/**
 * Global middleware: redirect unauthenticated users to /login
 *
 * Uses the shared useAuth() state (populated by the auth plugin on every load)
 * rather than a useCookie snapshot, which was unreliable during the first
 * navigation after login (the "second refresh" bug).
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // Allow auth-related and public pages
  if (
    to.path === '/login'
    || to.path === '/login-basic'
    || to.path.startsWith('/public')
    || to.path.startsWith('/sign')
  )
    return

  const { user, fetchUser } = useAuth()

  // On the server the auth plugin populates state before middleware runs.
  // On the client, if state is somehow missing (e.g. after a hot reload in dev),
  // do a single fetchUser() to confirm before deciding to redirect.
  if (!user.value) {
    await fetchUser()
  }

  if (!user.value) {
    return navigateTo('/login')
  }

  // Authenticated users hitting root → redirect to profile
  if (to.path === '/') {
    return navigateTo('/my-profile')
  }
})
