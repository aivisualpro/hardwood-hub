// Global middleware: redirect unauthenticated users to /login
export default defineNuxtRouteMiddleware((to) => {
    // Allow auth-related and public pages
    if (to.path === '/login' || to.path === '/login-basic' || to.path.startsWith('/public') || to.path.startsWith('/sign')) return

    // Check for user cookie (used for client-side auth state, since session is httpOnly)
    const userCookie = useCookie('hardwood_user')
    if (!userCookie.value) {
        return navigateTo('/login')
    }

    // Authenticated users hitting root → redirect to profile
    if (to.path === '/') {
        return navigateTo('/my-profile')
    }
})
