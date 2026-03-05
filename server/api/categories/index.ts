// GET /api/categories — list all
// POST /api/categories — create
import { connectDB } from '../../utils/mongoose'
import { Category } from '../../models/Category'

export default defineEventHandler(async (event) => {
    await connectDB()

    if (event.method === 'GET') {
        const categories = await Category.find().sort({ name: 1 }).lean()
        return { success: true, data: categories }
    }

    if (event.method === 'POST') {
        const body = await readBody(event)
        const { name, description, icon, color } = body
        if (!name) throw createError({ statusCode: 400, message: 'name is required' })
        const doc = await Category.create({ name, description, icon, color })
        return { success: true, data: doc }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
