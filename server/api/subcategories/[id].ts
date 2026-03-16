// GET    /api/subcategories/:id
// PUT    /api/subcategories/:id  — update predecessor (or any field)
import { connectDB } from '../../utils/mongoose'
import { SubCategory } from '../../models/SubCategory'

export default defineEventHandler(async (event) => {
    await connectDB()
    const id = getRouterParam(event, 'id')

    if (event.method === 'GET') {
        const sub = await SubCategory.findById(id).lean()
        if (!sub) throw createError({ statusCode: 404, message: 'SubCategory not found' })
        return { success: true, data: sub }
    }

    if (event.method === 'PUT') {
        const body = await readBody(event)
        const update: any = {}
        if (body.name !== undefined) update.subCategory = body.name // rename sub-category
        if (body.predecessor !== undefined) update.predecessor = body.predecessor
        if (body.subCategory !== undefined) update.subCategory = body.subCategory
        if (body.description !== undefined) update.description = body.description
        if (body.bonusRules !== undefined) update.bonusRules = body.bonusRules

        const updated = await SubCategory.findByIdAndUpdate(id, update, { returnDocument: 'after' }).lean()
        if (!updated) throw createError({ statusCode: 404, message: 'SubCategory not found' })
        return { success: true, data: updated }
    }

    if (event.method === 'DELETE') {
        const deleted = await SubCategory.findByIdAndDelete(id).lean()
        if (!deleted) throw createError({ statusCode: 404, message: 'SubCategory not found' })
        return { success: true, data: deleted }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
