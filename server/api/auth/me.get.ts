// GET /api/auth/me — return current authenticated user from session
import { connectDB } from '../../utils/mongoose'
import { Employee } from '../../models/Employee'
import { verifySessionToken } from '../../utils/session'

export default defineEventHandler(async (event) => {
    const token = getCookie(event, 'hardwood_session')
    if (!token)
        throw createError({ statusCode: 401, message: 'Not authenticated' })

    const session = verifySessionToken(token)
    if (!session)
        throw createError({ statusCode: 401, message: 'Invalid or expired session' })

    await connectDB()
    const employee = await Employee.findById(session.id).lean<any>()
    if (!employee)
        throw createError({ statusCode: 401, message: 'Employee not found' })

    if (employee.status === 'Inactive')
        throw createError({ statusCode: 403, message: 'Account deactivated' })

    return {
        success: true,
        data: {
            _id: String(employee._id),
            employee: employee.employee,
            email: employee.email,
            position: employee.position,
            profileImage: employee.profileImage,
            status: employee.status,
        },
    }
})
