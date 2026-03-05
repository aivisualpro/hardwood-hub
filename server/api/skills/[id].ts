// GET    /api/skills/:id
// PUT    /api/skills/:id
// DELETE /api/skills/:id
import { connectDB } from '../../utils/mongoose'
import { Skill } from '../../models/Skill'

export default defineEventHandler(async (event) => {
    await connectDB()
    const id = getRouterParam(event, 'id')

    if (event.method === 'GET') {
        const skill = await Skill.findById(id).lean()
        if (!skill) throw createError({ statusCode: 404, message: 'Skill not found' })
        return { success: true, data: skill }
    }

    if (event.method === 'PUT') {
        const body = await readBody(event)
        // Map frontend 'skill' field (real DB field name)
        const update: any = {}
        if (body.skill !== undefined) update.skill = body.skill
        if (body.description !== undefined) update.description = body.description
        if (body.level !== undefined) update.level = body.level
        if (body.icon !== undefined) update.icon = body.icon
        if (body.isRequired !== undefined) update.isRequired = body.isRequired
        if (body.category !== undefined) update.category = body.category
        if (body.subCategory !== undefined) update.subCategory = body.subCategory

        const updated = await Skill.findByIdAndUpdate(id, update, { new: true, returnDocument: 'after' }).lean()
        if (!updated) throw createError({ statusCode: 404, message: 'Skill not found' })
        return { success: true, data: updated }
    }

    if (event.method === 'DELETE') {
        await Skill.findByIdAndDelete(id)
        return { success: true }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
