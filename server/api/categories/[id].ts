// GET    /api/categories/:id
// PUT    /api/categories/:id  — update name, color, etc.
// DELETE /api/categories/:id
import { connectDB } from '../../utils/mongoose'
import { Category } from '../../models/Category'

export default defineEventHandler(async (event) => {
    await connectDB()
    const id = getRouterParam(event, 'id')

    if (event.method === 'GET') {
        const cat = await Category.findById(id).lean()
        if (!cat) throw createError({ statusCode: 404, message: 'Category not found' })
        return { success: true, data: cat }
    }

    if (event.method === 'PUT') {
        const body = await readBody(event)
        const update: any = {}
        if (body.name !== undefined) update.category = body.name // 'category' is the DB field
        if (body.description !== undefined) update.description = body.description
        if (body.icon !== undefined) update.icon = body.icon
        if (body.color !== undefined) update.color = body.color

        const updated = await Category.findByIdAndUpdate(id, update, { returnDocument: 'after' }).lean()
        if (!updated) throw createError({ statusCode: 404, message: 'Category not found' })
        return { success: true, data: updated }
    }

    if (event.method === 'DELETE') {
        const deleted = await Category.findByIdAndDelete(id).lean()
        if (!deleted) throw createError({ statusCode: 404, message: 'Category not found' })
        return { success: true, data: deleted }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
