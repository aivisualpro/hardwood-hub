// POST /api/employees/set-all-active — one-time migration to set all employees to Active
import { connectDB } from '../../utils/mongoose'
import { Employee } from '../../models/Employee'

export default defineEventHandler(async (event) => {
    await connectDB()

    if (event.method !== 'POST')
        throw createError({ statusCode: 405, message: 'Method not allowed' })

    const result = await Employee.updateMany(
        { $or: [{ status: { $exists: false } }, { status: null }, { status: '' }] },
        { $set: { status: 'Active' } },
    )

    return { success: true, modified: result.modifiedCount }
})
