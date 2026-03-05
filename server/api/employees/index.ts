// GET /api/employees  — list all
// POST /api/employees — create
import { connectDB } from '../../utils/mongoose'
import { Employee } from '../../models/Employee'

export default defineEventHandler(async (event) => {
    await connectDB()

    if (event.method === 'GET') {
        const employees = await Employee.find().sort({ createdAt: -1 }).lean()
        return { success: true, data: employees }
    }

    if (event.method === 'POST') {
        const body = await readBody(event)
        const { employee, email, position, profileImage } = body

        if (!employee || !email || !position) {
            throw createError({ statusCode: 400, message: 'employee, email and position are required' })
        }

        const doc = await Employee.create({ employee, email, position, profileImage: profileImage || '' })
        return { success: true, data: doc }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
