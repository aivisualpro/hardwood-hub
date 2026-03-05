// POST /api/auth/logout — clear session cookie
export default defineEventHandler(async (event) => {
    deleteCookie(event, 'hardwood_session', { path: '/' })
    return { success: true }
})
