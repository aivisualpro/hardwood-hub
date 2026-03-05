// Global middleware: redirect unauthenticated users to /login
export default defineNuxtRouteMiddleware((to) => {
    // Allow auth-related pages
    if (to.path === '/login' || to.path === '/login-basic') return

    // Check for session cookie
    const sessionCookie = useCookie('hardwood_session')
    if (!sessionCookie.value) {
        return navigateTo('/login')
    }
})
