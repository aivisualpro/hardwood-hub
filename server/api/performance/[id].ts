// PUT    /api/performance/:id — update a performance record
// DELETE /api/performance/:id — delete a performance record
import { connectDB } from '../../utils/mongoose'
import { EmpSkillPerformance } from '../../models/EmpSkillPerformance'

export default defineEventHandler(async (event) => {
    await connectDB()
    const id = getRouterParam(event, 'id')

    if (event.method === 'PUT') {
        const body = await readBody(event)
        const doc = await EmpSkillPerformance.findByIdAndUpdate(id, body, { returnDocument: 'after' }).lean()
        if (!doc) throw createError({ statusCode: 404, message: 'Record not found' })
        return { success: true, data: doc }
    }

    if (event.method === 'DELETE') {
        const doc = await EmpSkillPerformance.findByIdAndDelete(id).lean()
        if (!doc) throw createError({ statusCode: 404, message: 'Record not found' })
        return { success: true }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
