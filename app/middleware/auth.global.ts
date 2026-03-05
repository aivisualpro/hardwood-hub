// Global middleware: redirect unauthenticated users to /login
export default defineNuxtRouteMiddleware(async (to) => {
    // Allow login page
    if (to.path === '/login' || to.path === '/login-basic') return

    // Check if we have a session
    try {
        await $fetch('/api/auth/me')
    }
    catch {
        return navigateTo('/login')
    }
})
