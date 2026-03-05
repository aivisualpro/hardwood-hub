// PUT    /api/skill-bonus/:id — update
// DELETE /api/skill-bonus/:id — delete
import { connectDB } from '../../utils/mongoose'
import { SkillBonus } from '../../models/SkillBonus'

export default defineEventHandler(async (event) => {
    await connectDB()
    const id = getRouterParam(event, 'id')

    if (event.method === 'PUT') {
        const body = await readBody(event)
        const doc = await SkillBonus.findByIdAndUpdate(id, body, { returnDocument: 'after' }).lean()
        if (!doc) throw createError({ statusCode: 404, message: 'Record not found' })
        return { success: true, data: doc }
    }

    if (event.method === 'DELETE') {
        const doc = await SkillBonus.findByIdAndDelete(id).lean()
        if (!doc) throw createError({ statusCode: 404, message: 'Record not found' })
        return { success: true }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
