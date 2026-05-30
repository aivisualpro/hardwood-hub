import { SubCategory } from '../../models/SubCategory'
// GET /api/subcategories — list all (optionally filtered by ?category=id)
// POST /api/subcategories — create
import { connectDB } from '../../utils/mongoose'
import { requireAdmin, requireManager } from '../../utils/requireRole'
import { SubcategoryWriteSchema, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  requireAdmin(event)

  if (event.method === 'GET') {
    const query = getQuery(event)
    const filter: any = {}
    if (query.category)
      filter.category = query.category
    const subs = await SubCategory.find(filter).sort({ name: 1 }).lean()
    return { success: true, data: subs }
  }

  if (event.method === 'POST') {
    const raw = await readBody(event)
    const data = parseBody(SubcategoryWriteSchema, raw)
    const doc = await SubCategory.create({ subCategory: data.subCategory, category: data.category, icon: data.icon, color: data.color, order: data.order })
    return { success: true, data: doc }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})

