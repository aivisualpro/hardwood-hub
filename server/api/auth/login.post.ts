// POST /api/auth/login — validate email against hardwoodDB_Employees
import { connectDB } from '../../utils/mongoose'
import { Employee } from '../../models/Employee'

export default defineEventHandler(async (event) => {
    await connectDB()

    if (event.method !== 'POST')
        throw createError({ statusCode: 405, message: 'Method not allowed' })

    const body = await readBody(event)
    const { email } = body
    if (!email)
        throw createError({ statusCode: 400, message: 'Email is required' })

    const employee = await Employee.findOne({ email: email.toLowerCase() }).lean<any>()

    if (!employee)
        throw createError({ statusCode: 401, message: 'No employee found with this email. Please contact your administrator.' })

    if (employee.status === 'Inactive')
        throw createError({ statusCode: 403, message: 'Your account has been deactivated. Please contact your administrator.' })

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
