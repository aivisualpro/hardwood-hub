// Global middleware: redirect unauthenticated users to /login
export default defineNuxtRouteMiddleware(async (to) => {
    // Allow auth-related pages
    if (to.path === '/login' || to.path === '/login-basic') return

    // On server-side, check for the cookie existence directly
    if (import.meta.server) {
        const cookie = useCookie('hardwood_session')
        if (!cookie.value) return navigateTo('/login')
        return
    }

    // On client-side, verify the session is still valid
    try {
        await $fetch('/api/auth/me')
    }
    catch {
        return navigateTo('/login')
    }
})
