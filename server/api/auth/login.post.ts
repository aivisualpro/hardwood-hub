// POST /api/auth/login — DEPRECATED
// Basic email-only login is disabled for security.
// All authentication must go through Google OAuth (/api/auth/google).
export default defineEventHandler(async () => {
    throw createError({
        statusCode: 403,
        message: 'Basic email login is disabled. Please use Google Sign-In.',
    })
})
