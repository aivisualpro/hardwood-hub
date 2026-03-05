// POST /api/auth/google — verify Google credential and create a session
import { connectDB } from '../../utils/mongoose'
import { Employee } from '../../models/Employee'
import { createSessionToken } from '../../lib/session'

// Verify Google ID token via Google's tokeninfo endpoint
async function verifyGoogleToken(credential: string): Promise<{
    email: string
    name: string
    picture: string
    sub: string
}> {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`)
    if (!res.ok) throw new Error('Invalid Google token')
    const payload = await res.json()

    // Verify audience matches our client ID
    const clientId = process.env.GOOGLE_CLIENT_ID
    if (clientId && payload.aud !== clientId) {
        throw new Error('Token audience mismatch')
    }

    return {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        sub: payload.sub,
    }
}

export default defineEventHandler(async (event) => {
    await connectDB()

    if (event.method !== 'POST')
        throw createError({ statusCode: 405, message: 'Method not allowed' })

    const body = await readBody(event)
    const { credential } = body

    if (!credential)
        throw createError({ statusCode: 400, message: 'Google credential token is required' })

    // 1. Verify Google token
    let googleUser: { email: string, name: string, picture: string, sub: string }
    try {
        googleUser = await verifyGoogleToken(credential)
    }
    catch (e: any) {
        throw createError({ statusCode: 401, message: 'Invalid Google token: ' + (e?.message || 'verification failed') })
    }

    // 2. Check employee exists
    const employee = await Employee.findOne({ email: googleUser.email.toLowerCase() }).lean<any>()
    if (!employee)
        throw createError({ statusCode: 401, message: `No employee account found for ${googleUser.email}. Please contact your administrator.` })

    if (employee.status === 'Inactive')
        throw createError({ statusCode: 403, message: 'Your account has been deactivated. Please contact your administrator.' })

    // 3. Create session token
    const sessionToken = createSessionToken(String(employee._id), employee.email)

    // 4. Set secure HTTP-only cookie
    setCookie(event, 'hardwood_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
    })

    return {
        success: true,
        data: {
            _id: String(employee._id),
            employee: employee.employee,
            email: employee.email,
            position: employee.position,
            profileImage: employee.profileImage || googleUser.picture,
            status: employee.status,
            workspace: employee.workspace || '',
        },
    }
})
