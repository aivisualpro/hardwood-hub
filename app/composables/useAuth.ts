/**
 * useAuth — single source of truth for the authenticated user
 *
 * Replaces scattered useCookie('hardwood_user') reads throughout the app.
 * The state is shared across all component instances via useState(), which
 * is SSR-safe and reactive.
 *
 * Usage:
 *   const { user, fetchUser, setUser, clearUser, isAuthenticated } = useAuth()
 *
 * On SSR: app.vue / a plugin calls fetchUser() once; the state is serialised
 *   into the payload and hydrated on the client — no double-fetch.
 * On login: SignIn.vue calls setUser(res.data) to set immediately, then
 *   fetchUser() to confirm.
 * On 401 refresh: authRefresh.client.ts calls fetchUser() after a successful
 *   token refresh so all reactive watchers re-run.
 */

export interface AuthUser {
  _id: string
  employee: string
  email: string
  position: string
  profileImage: string
  status: string
  workspace: string
}

// Single global state — shared across all useAuth() calls in the same Nuxt app
const useAuthState = () => useState<AuthUser | null>('auth-user', () => null)

export function useAuth() {
  const user = useAuthState()
  const isAuthenticated = computed(() => user.value !== null)

  /**
   * Fetch the current user from /api/auth/me and populate the shared state.
   * Safe to call on both server and client — passes cookies via useRequestHeaders.
   * Returns the user on success, null on any error (treats 401/403 as "not logged in").
   */
  async function fetchUser(): Promise<AuthUser | null> {
    try {
      const res = await $fetch<{ success: boolean, data: AuthUser }>('/api/auth/me', {
        headers: useRequestHeaders(['cookie']),
        ignoreResponseError: true,
      })
      if (!res?.success) throw new Error('Not authenticated')
      user.value = res.data
      return res.data
    }
    catch {
      user.value = null
      return null
    }
  }

  /**
   * Optimistically set the user from a login response (before the DB round-trip).
   * Always follow with fetchUser() to confirm and pick up any extra fields.
   */
  function setUser(data: AuthUser) {
    user.value = data
  }

  /** Clear auth state (used on logout). */
  function clearUser() {
    user.value = null
  }

  return {
    user,
    isAuthenticated,
    fetchUser,
    setUser,
    clearUser,
  }
}
