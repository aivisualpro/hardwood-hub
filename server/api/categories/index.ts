import { Category } from '../../models/Category'
// GET /api/categories — list all
// POST /api/categories — create
import { connectDB } from '../../utils/mongoose'
import { requireAdmin, requireManager } from '../../utils/requireRole'
import { CategoryWriteSchema, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  await connectDB()
  requireAdmin(event)

  if (event.method === 'GET') {
    const categories = await Category.find().sort({ name: 1 }).lean()
    return { success: true, data: categories }
  }

  if (event.method === 'POST') {
    const raw = await readBody(event)
    const data = parseBody(CategoryWriteSchema, raw)
    const doc = await Category.create({ category: data.category, icon: data.icon, color: data.color, order: data.order })
    return { success: true, data: doc }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
