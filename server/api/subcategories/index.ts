// GET /api/subcategories — list all (optionally filtered by ?category=id)
// POST /api/subcategories — create
import { connectDB } from '../../utils/mongoose'
import { SubCategory } from '../../models/SubCategory'

export default defineEventHandler(async (event) => {
    await connectDB()

    if (event.method === 'GET') {
        const query = getQuery(event)
        const filter: any = {}
        if (query.category) filter.Category = query.category
        const subs = await SubCategory.find(filter).sort({ name: 1 }).lean()
        return { success: true, data: subs }
    }

    if (event.method === 'POST') {
        const body = await readBody(event)
        const { name, Category: cat, description, icon } = body
        if (!name || !cat) throw createError({ statusCode: 400, message: 'name and Category are required' })
        const doc = await SubCategory.create({ name, Category: cat, description, icon })
        return { success: true, data: doc }
    }

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
