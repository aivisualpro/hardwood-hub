// POST /api/auth/revoke — invalidate ALL sessions for a given employee ("log out everywhere")
// Body: { targetId?: string }  — omit to revoke the caller's own sessions.
// An employee can always revoke their own sessions.
// Revoking another employee requires an active session (admin-level enforcement left to app layer).
import { connectDB } from '../../utils/mongoose'
import { Employee } from '../../models/Employee'
import { verifySessionToken } from '../../lib/session'
import { invalidateEpochCache } from '../../lib/epochCache'

export default defineEventHandler(async (event) => {
    // Caller must have a valid access token (public middleware already guards non-auth routes,
    // but /api/auth/ is whitelisted — so we do our own check here)
    const token = getCookie(event, 'hardwood_session')
    if (!token)
        throw createError({ statusCode: 401, message: 'Authentication required.' })

    const callerSession = verifySessionToken(token)
    if (!callerSession || callerSession.type !== 'access')
        throw createError({ statusCode: 401, message: 'Invalid session.' })

    const body = await readBody(event).catch(() => ({}))
    // Default: revoke own sessions
    const targetId: string = body?.targetId || callerSession.id

    await connectDB()

    // Atomically bump epoch — all tokens with the old epoch are now dead
    const updated = await Employee.findByIdAndUpdate(
        targetId,
        { $inc: { sessionEpoch: 1 } },
        { new: true, select: 'sessionEpoch' },
    ).lean<any>()

    if (!updated)
        throw createError({ statusCode: 404, message: 'Employee not found.' })

    // Evict in-process cache immediately
    invalidateEpochCache(targetId)

    // If revoking own session, clear cookies too
    if (targetId === callerSession.id) {
        deleteCookie(event, 'hardwood_session', { path: '/' })
        deleteCookie(event, 'hardwood_refresh',  { path: '/' })
    }

    return {
        success: true,
        message: targetId === callerSession.id
            ? 'All your sessions have been revoked.'
            : `All sessions for employee ${targetId} have been revoked.`,
        newEpoch: updated.sessionEpoch,
    }
})
