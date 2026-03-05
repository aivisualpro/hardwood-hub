// GET    /api/employees/:id
// PUT    /api/employees/:id
// DELETE /api/employees/:id
import { connectDB } from '../../utils/mongoose'
import { Employee } from '../../models/Employee'

export default defineEventHandler(async (event) => {
    await connectDB()
    const id = getRouterParam(event, 'id')

    if (event.method === 'GET') {
        const doc = await Employee.findById(id).lean()
        if (!doc) throw createError({ statusCode: 404, message: 'Employee not found' })
        return { success: true, data: doc }
    }

    if (event.method === 'PUT') {
        const body = await readBody(event)
        const updated = await Employee.findByIdAndUpdate(id, body, { returnDocument: 'after', runValidators: true }).lean()
        if (!updated) throw createError({ statusCode: 404, message: 'Employee not found' })
        return { success: true, data: updated }
    }

    if (event.method === 'DELETE') {
        const deleted = await Employee.findByIdAndDelete(id).lean()
        if (!deleted) throw createError({ statusCode: 404, message: 'Employee not found' })
        return { success: true, message: 'Employee deleted' }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
